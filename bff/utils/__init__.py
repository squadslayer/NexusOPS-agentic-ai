"""Utilities package for BFF.

Contains response formatting, helpers, and other utility functions.
"""

from .response_envelope import (
    StandardResponseEnvelope,
    ResponseMeta,
    create_success_response,
    create_error_response,
    mask_aws_error
)
from .auth_utils import (
    encode_jwt,
    decode_jwt,
    extract_token_from_header
)

__all__ = [
    'StandardResponseEnvelope',
    'ResponseMeta',
    'create_success_response',
    'create_error_response',
    'mask_aws_error',
    'encode_jwt',
    'decode_jwt',
    'extract_token_from_header'
]
