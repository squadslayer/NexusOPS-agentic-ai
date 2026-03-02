"""Request validation middleware for Track 6: Governance & Hardening.

Acts as the *schema gatekeeper* that runs **before** orchestrator invocation.
Rejects:
  1. Requests with a missing ``repo_id``.
  2. Payloads that don't conform to the Track 2 request schema.
  3. Oversized requests (> 1 MB raw body).
"""

import logging
from functools import wraps

from flask import request, g

from bff.utils.response_envelope import create_error_response
from bff.middleware.error_handler import format_response_for_api, generate_execution_id

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_CONTENT_LENGTH_BYTES = 1 * 1024 * 1024   # 1 MB

# Keys that are allowed in the top-level request body for /executions/start
_ALLOWED_TOP_LEVEL_KEYS = frozenset({"repo_id", "input"})


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_content_length() -> str | None:
    """Return an error message if the request body exceeds the size limit."""
    content_length = request.content_length
    if content_length is not None and content_length > MAX_CONTENT_LENGTH_BYTES:
        return (
            f"Request body too large ({content_length} bytes). "
            f"Maximum allowed is {MAX_CONTENT_LENGTH_BYTES} bytes (1 MB)."
        )
    return None


def _validate_json_body(body: dict) -> str | None:
    """Return an error message if the body violates the Track 2 schema.

    Rules enforced:
    * ``repo_id`` must be present and a non-empty string.
    * ``input`` (if provided) must be a dict.
    * No unknown top-level keys are permitted.
    """
    # --- Unknown keys ---------------------------------------------------
    unknown = set(body.keys()) - _ALLOWED_TOP_LEVEL_KEYS
    if unknown:
        return f"Unknown fields in request body: {', '.join(sorted(unknown))}"

    # --- repo_id ---------------------------------------------------------
    repo_id = body.get("repo_id")
    if repo_id is None:
        return "Missing required field: repo_id"
    if not isinstance(repo_id, str) or not repo_id.strip():
        return "Field 'repo_id' must be a non-empty string"

    # --- input -----------------------------------------------------------
    user_input = body.get("input")
    if user_input is not None and not isinstance(user_input, dict):
        return "Field 'input' must be a JSON object (dict)"

    return None


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------

def validate_execution_request(f):
    """Decorator that validates incoming execution requests.

    Must be applied **after** ``@require_auth`` and **before** the route
    handler so invalid payloads never reach the orchestrator client.

    Checks:
    1. Content-Length ≤ 1 MB
    2. Body is valid JSON
    3. Schema conforms to Track 2 contract (``repo_id`` required,
       ``input`` optional dict, no unknown keys)

    On failure returns **400 Bad Request** wrapped in the Track 2
    Standard Response Envelope.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        execution_id = getattr(g, "execution_id", generate_execution_id())

        # --- Size guard -------------------------------------------------
        size_error = _validate_content_length()
        if size_error:
            logger.warning(
                "Request rejected — oversized payload (execution_id: %s): %s",
                execution_id,
                size_error,
            )
            resp = create_error_response(
                error_message=size_error,
                error_code="VALIDATION_ERROR",
                execution_id=execution_id,
                stage="ASK",
            )
            return format_response_for_api(resp, 400)

        # --- JSON parse -------------------------------------------------
        body = request.get_json(silent=True)
        if body is None:
            logger.warning(
                "Request rejected — invalid or missing JSON body (execution_id: %s)",
                execution_id,
            )
            resp = create_error_response(
                error_message="Request body must be valid JSON",
                error_code="VALIDATION_ERROR",
                execution_id=execution_id,
                stage="ASK",
            )
            return format_response_for_api(resp, 400)

        # --- Schema validation ------------------------------------------
        schema_error = _validate_json_body(body)
        if schema_error:
            logger.warning(
                "Request rejected — schema violation (execution_id: %s): %s",
                execution_id,
                schema_error,
            )
            resp = create_error_response(
                error_message=schema_error,
                error_code="VALIDATION_ERROR",
                execution_id=execution_id,
                stage="ASK",
            )
            return format_response_for_api(resp, 400)

        return f(*args, **kwargs)

    return decorated_function
