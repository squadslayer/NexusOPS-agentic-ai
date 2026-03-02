"""Middleware package for BFF.

Contains all middleware components including error handling, authentication,
and request/response processing.
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

__all__ = [
    'governance_error_handler',
    'register_error_handlers',
    'generate_execution_id',
    'format_response_for_api',
    'require_auth'
]
