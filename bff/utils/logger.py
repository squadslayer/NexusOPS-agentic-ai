"""Structured audit logger for Track 6: Governance & Hardening.

Every request that passes through the BFF is logged with:
  - request_id
  - user_id
  - endpoint
  - timestamp (ISO 8601)
  - status (HTTP status code)

CONSTRAINT: Execution details are NEVER logged here — the orchestrator
owns those logs.
"""

import logging
import time
from datetime import datetime, timezone
from functools import wraps

import uuid
from flask import request, g

def _generate_execution_id() -> str:
    """Local copy to avoid circular import with middleware.error_handler."""
    return str(uuid.uuid4())

logger = logging.getLogger("bff.audit")

# ---------------------------------------------------------------------------
# Structured formatter
# ---------------------------------------------------------------------------

class AuditFormatter(logging.Formatter):
    """JSON-like structured formatter for audit log entries."""

    def format(self, record: logging.LogRecord) -> str:
        # Attach audit fields if present
        audit = getattr(record, "audit", None)
        if audit:
            parts = " | ".join(f"{k}={v}" for k, v in audit.items())
            record.msg = f"[AUDIT] {parts}"
        return super().format(record)


def _setup_audit_logger() -> logging.Logger:
    """Configure the ``bff.audit`` logger with the structured formatter.

    Called once at module load; subsequent calls are idempotent.
    """
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            AuditFormatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


_setup_audit_logger()


# ---------------------------------------------------------------------------
# Core logging function
# ---------------------------------------------------------------------------

def log_request(
    request_id: str,
    user_id: str,
    endpoint: str,
    status: int,
    *,
    method: str = "",
    duration_ms: float | None = None,
) -> None:
    """Emit a structured audit log entry for a completed request.

    Args:
        request_id: Unique request / execution tracking ID.
        user_id: Authenticated user ID (from Track 3).
        endpoint: The route that handled the request.
        status: HTTP status code of the response.
        method: HTTP method (GET, POST, …).
        duration_ms: Optional elapsed time in milliseconds.

    CONSTRAINT: No execution details (payload, orchestrator response,
    Lambda logs) are included — the orchestrator owns those.
    """
    audit_data = {
        "request_id": request_id,
        "user_id": user_id,
        "endpoint": endpoint,
        "method": method,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
    }
    if duration_ms is not None:
        audit_data["duration_ms"] = round(duration_ms, 2)

    logger.info("", extra={"audit": audit_data})


# ---------------------------------------------------------------------------
# Decorator — automatic per-request audit logging
# ---------------------------------------------------------------------------

def audit_log(f):
    """Decorator that automatically logs every request after the response is
    produced.

    Must be applied **after** ``@require_auth`` (so that ``g.user_id`` is
    available) and typically as the *outermost* decorator after auth.

    The log captures request_id, user_id, endpoint, timestamp, and HTTP
    status — nothing more.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start = time.perf_counter()
        execution_id = getattr(g, "execution_id", _generate_execution_id())

        result = f(*args, **kwargs)

        # Determine the status code from whatever the handler returned
        if isinstance(result, tuple):
            status_code = result[1] if len(result) >= 2 else 200
        else:
            status_code = 200

        elapsed = (time.perf_counter() - start) * 1000

        log_request(
            request_id=execution_id,
            user_id=getattr(g, "user_id", "unknown"),
            endpoint=request.endpoint or request.path,
            status=status_code,
            method=request.method,
            duration_ms=elapsed,
        )

        return result

    return decorated_function
