"""JWT utilities for encoding and decoding authentication tokens.

This module provides functions to encode and decode JWTs with strict payload validation.
"""

import jwt
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from bff import config

logger = logging.getLogger(__name__)


def encode_jwt(user_id: str, email: str) -> str:
    """
    Encode a JWT token with user identity information.
    
    PAYLOAD STRUCTURE:
    {
        "user_id": "uuid",
        "email": "user@example.com",
        "iss": "nexusops-bff",
        "exp": timestamp
    }
    
    Args:
        user_id (str): UUID of the user
        email (str): Email address of the user
        
    Returns:
        str: Encoded JWT token
        
    Raises:
        Exception: If encoding fails
        
    Example:
        token = encode_jwt(user_id="abc-123", email="user@example.com")
    """
    try:
        # Calculate expiration timestamp
        expiration = datetime.utcnow() + timedelta(hours=config.JWT_EXPIRATION_HOURS)
        
        # Build payload with required fields
        payload = {
            "user_id": user_id,
            "email": email,
            "iss": "nexusops-bff",
            "exp": expiration
        }
        
        # Encode JWT
        token = jwt.encode(
            payload,
            config.JWT_SECRET,
            algorithm=config.JWT_ALGORITHM
        )
        
        logger.debug(f"JWT token encoded for user: {user_id}")
        return token
    
    except Exception as e:
        logger.error(f"Failed to encode JWT for user {user_id}: {str(e)}")
        raise


def decode_jwt(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT token.
    
    STRICT VALIDATION:
    - Token must be present and non-empty
    - Signature must be valid
    - Token must not be expired
    - Payload must contain user_id and email
    
    Args:
        token (str): The JWT token to decode
        
    Returns:
        Dict: Decoded payload with user_id, email, exp, iss
        
    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidSignatureError: If signature is invalid
        jwt.DecodeError: If token cannot be decoded
        ValueError: If required fields are missing
        
    Example:
        payload = decode_jwt(token)
        user_id = payload["user_id"]
    """
    if not token:
        raise ValueError("Token is required")
    
    try:
        # Decode and validate JWT
        payload = jwt.decode(
            token,
            config.JWT_SECRET,
            algorithms=[config.JWT_ALGORITHM]
        )
        
        # Validate required fields
        required_fields = ["user_id", "email", "exp", "iss"]
        for field in required_fields:
            if field not in payload:
                raise ValueError(f"Missing required field in token: {field}")
        
        logger.debug(f"JWT token decoded successfully for user: {payload['user_id']}")
        return payload
    
    except jwt.ExpiredSignatureError:
        logger.warning(f"JWT token expired")
        raise
    except jwt.InvalidSignatureError:
        logger.warning(f"JWT token has invalid signature")
        raise
    except jwt.DecodeError:
        logger.warning(f"JWT token cannot be decoded")
        raise
    except ValueError as e:
        logger.warning(f"JWT validation error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error decoding JWT: {str(e)}")
        raise


def extract_token_from_header(auth_header: Optional[str]) -> Optional[str]:
    """
    Extract Bearer token from Authorization header.
    
    Expected format: "Bearer {token}"
    
    Args:
        auth_header (Optional[str]): The Authorization header value
        
    Returns:
        Optional[str]: The token if present, None otherwise
        
    Example:
        token = extract_token_from_header("Bearer eyJhbGc...")
    """
    if not auth_header:
        return None
    
    try:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        return None
    except Exception:
        return None
