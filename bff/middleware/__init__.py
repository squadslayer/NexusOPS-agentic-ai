"""Middleware package for BFF.

Contains all middleware components including error handling, authentication,
rate limiting, request validation, and request/response processing.
"""

from .error_handler import (
    governance_error_handler,
    register_error_handlers,
    generate_execution_id,
    format_response_for_api
)
from .auth_middleware import (
    require_auth
)
from .auth_fastapi import (
    require_auth_fastapi
)
from .rate_limit import (
    rate_limit,
    check_rate_limit
)
from .validation import (
    validate_execution_request
)

__all__ = [
    'governance_error_handler',
    'register_error_handlers',
    'generate_execution_id',
    'format_response_for_api',
    'require_auth',
    'rate_limit',
    'check_rate_limit',
    'validate_execution_request',
]
