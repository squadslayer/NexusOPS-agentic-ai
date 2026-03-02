"""Rate-limiting middleware for Track 6: Governance & Hardening.

Enforces a per-user execution cap using a DynamoDB conditional counter.
Rule: Max 5 executions per minute per ``user_id``.

The counter table (``RateLimitCounters``) schema:
    PK  : user_id  (S)
    Attrs: execution_count (N), window_start (N — epoch seconds), ttl (N)

Each entry auto-expires via DynamoDB TTL so stale windows are reaped
without a scan.
"""

import logging
import time
from functools import wraps

import boto3
from botocore.exceptions import ClientError
from flask import g

from bff import config
from bff.utils.response_envelope import create_error_response
from bff.middleware.error_handler import format_response_for_api, generate_execution_id

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_EXECUTIONS_PER_WINDOW = 5        # requests allowed
WINDOW_SECONDS = 60                  # sliding window length
TABLE_NAME = "RateLimitCounters"
TTL_PAD_SECONDS = 120                # extra TTL so DynamoDB has time to reap


def _get_table():
    """Return a DynamoDB Table resource for the rate-limit counters."""
    dynamodb = boto3.resource(
        "dynamodb",
        region_name=config.AWS_REGION,
        endpoint_url=config.DYNAMODB_ENDPOINT if config.DYNAMODB_ENDPOINT else None,
    )
    return dynamodb.Table(TABLE_NAME)


def _current_window_start() -> int:
    """Return the epoch second that begins the current 60-second window."""
    now = int(time.time())
    return now - (now % WINDOW_SECONDS)


# ---------------------------------------------------------------------------
# Core check
# ---------------------------------------------------------------------------

def _check_rate_limit(user_id: str) -> bool:
    """Atomically increment the user's counter and return whether the request
    is within the allowed budget.

    Uses a DynamoDB *conditional* UpdateItem:
    * If the window has rotated the counter resets to 1.
    * If still inside the window the counter is incremented only when it is
      below ``MAX_EXECUTIONS_PER_WINDOW``.

    Returns:
        True  — request is allowed.
        False — rate limit exceeded.
    """
    table = _get_table()
    window_start = _current_window_start()
    ttl_value = window_start + WINDOW_SECONDS + TTL_PAD_SECONDS

    # --- Attempt 1: increment inside the current window ----------------
    try:
        table.update_item(
            Key={"user_id": user_id},
            UpdateExpression=(
                "SET execution_count = execution_count + :inc, "
                "    #ttl = :ttl"
            ),
            ConditionExpression=(
                "attribute_exists(user_id) AND "
                "window_start = :ws AND "
                "execution_count < :max_count"
            ),
            ExpressionAttributeNames={"#ttl": "ttl"},
            ExpressionAttributeValues={
                ":inc": 1,
                ":ws": window_start,
                ":max_count": MAX_EXECUTIONS_PER_WINDOW,
                ":ttl": ttl_value,
            },
        )
        logger.debug("Rate-limit counter incremented for user %s", user_id)
        return True

    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code != "ConditionalCheckFailedException":
            logger.error("DynamoDB error during rate-limit check: %s", exc)
            # Fail-open: don't block legitimate traffic on infra errors
            return True

    # --- Attempt 2: window rotated (or first request) — reset counter --
    try:
        table.put_item(
            Item={
                "user_id": user_id,
                "execution_count": 1,
                "window_start": window_start,
                "ttl": ttl_value,
            },
            ConditionExpression=(
                "attribute_not_exists(user_id) OR "
                "window_start < :ws"
            ),
            ExpressionAttributeValues={":ws": window_start},
        )
        logger.debug("Rate-limit window reset for user %s", user_id)
        return True

    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code == "ConditionalCheckFailedException":
            # Another request already rotated the window AND the counter is
            # now at the limit — deny.
            logger.warning(
                "Rate limit exceeded for user %s (window_start=%s)",
                user_id,
                window_start,
            )
            return False

        logger.error("DynamoDB error during rate-limit reset: %s", exc)
        # Fail-open
        return True


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------

def rate_limit(f):
    """Decorator that enforces 5-executions-per-minute per ``user_id``.

    Must be applied **after** ``@require_auth`` so that ``g.user_id`` is
    available.

    On limit breach returns **429 Too Many Requests** wrapped in the
    Track 2 Standard Response Envelope.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = getattr(g, "user_id", None)
        if not user_id:
            # Should never happen if @require_auth ran first
            execution_id = getattr(g, "execution_id", generate_execution_id())
            resp = create_error_response(
                error_message="Authentication required",
                error_code="AUTH_ERROR",
                execution_id=execution_id,
            )
            return format_response_for_api(resp, 401)

        if not _check_rate_limit(user_id):
            execution_id = getattr(g, "execution_id", generate_execution_id())
            logger.warning(
                "Rate-limit 429 returned for user %s (execution_id: %s)",
                user_id,
                execution_id,
            )
            resp = create_error_response(
                error_message="Rate limit exceeded. Maximum 5 executions per minute.",
                error_code="RATE_LIMIT_EXCEEDED",
                execution_id=execution_id,
                stage="ASK",
            )
            return format_response_for_api(resp, 429)

        return f(*args, **kwargs)

    return decorated_function
