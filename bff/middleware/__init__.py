"""Middleware package for BFF.

Contains all middleware components including error handling, authentication,
and request/response processing.
"""

from .error_handler import (
    govenance_error_handler,
    register_error_handlers,
    generate_execution_id,
    format_response_for_api
)

__all__ = [
    'govenance_error_handler',
    'register_error_handlers',
    'generate_execution_id',
    'format_response_for_api'
]
