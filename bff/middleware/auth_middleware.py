"""Authentication middleware for JWT verification and user context injection.

This middleware enforces strict JWT validation before requests reach route handlers.
"""

import logging
import jwt
from functools import wraps
from flask import request, g
from bff.utils.auth_utils import decode_jwt, extract_token_from_header
from bff.utils.response_envelope import create_error_response
from bff.middleware.error_handler import format_response_for_api, generate_execution_id
from bff import config

logger = logging.getLogger(__name__)


def require_auth(f):
    """
    Decorator for routes that require authentication.
    
    STRICT REJECTION FLOW:
    1. Request arrives with Authorization header
    2. Extract Bearer token
    3. Decode and validate JWT
    4. Inject user_id into Flask g object
    5. Pass to route handler OR return 401 error
    
    STRICT REJECTION CONDITIONS:
    - No Authorization header → 401 Unauthorized
    - Missing or invalid Bearer token → 401 Unauthorized
    - Token expired → 401 Unauthorized
    - Invalid signature → 401 Unauthorized
    - Missing required fields → 401 Unauthorized
    
    CONTEXT INJECTION:
    If valid, sets:
    - g.user_id: The authenticated user's ID
    - g.user_email: The authenticated user's email
    - g.execution_id: Tracking ID for this request
    
    Usage:
        @app.route('/protected')
        @require_auth
        def protected_route():
            user_id = g.user_id  # Injected by middleware
            return create_success_response(data={'user': user_id}, execution_id=g.execution_id)
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        execution_id = generate_execution_id()
        g.execution_id = execution_id
        
        # If AUTH_BYPASS is enabled (local mode), skip authentication
        if config.AUTH_BYPASS:
            logger.debug(f"Auth bypass enabled (LOCAL mode)")
            g.user_id = "local-dev-user"
            g.user_email = "dev@local.com"
            return f(*args, **kwargs)
        
        # Get Authorization header
        auth_header = request.headers.get('Authorization')
        
        # Check if header is present
        if not auth_header:
            logger.warning(f"Missing Authorization header (execution_id: {execution_id})")
            response = create_error_response(
                error_message="Missing Authorization header",
                error_code="AUTH_ERROR",
                execution_id=execution_id
            )
            return format_response_for_api(response, 401)
        
        # Extract token from header
        token = extract_token_from_header(auth_header)
        if not token:
            logger.warning(f"Invalid Authorization header format (execution_id: {execution_id})")
            response = create_error_response(
                error_message="Invalid Authorization header format",
                error_code="AUTH_ERROR",
                execution_id=execution_id
            )
            return format_response_for_api(response, 401)
        
        # Decode and validate token
        try:
            payload = decode_jwt(token)
            
            # Extract user information from payload
            user_id = payload.get("user_id")
            user_email = payload.get("email")
            
            # Inject into Flask g object for route handler access
            g.user_id = user_id
            g.user_email = user_email
            
            logger.info(f"User authenticated: {user_id} (execution_id: {execution_id})")
            
            # Continue to route handler
            return f(*args, **kwargs)
        
        except jwt.ExpiredSignatureError:
            logger.warning(f"JWT token expired (execution_id: {execution_id})")
            response = create_error_response(
                error_message="Authentication token expired",
                error_code="AUTH_ERROR",
                execution_id=execution_id
            )
            return format_response_for_api(response, 401)
        
        except jwt.InvalidSignatureError:
            logger.warning(f"JWT token has invalid signature (execution_id: {execution_id})")
            response = create_error_response(
                error_message="Invalid authentication token",
                error_code="AUTH_ERROR",
                execution_id=execution_id
            )
            return format_response_for_api(response, 401)
        
        except jwt.DecodeError:
            logger.warning(f"JWT token cannot be decoded (execution_id: {execution_id})")
            response = create_error_response(
                error_message="Invalid authentication token",
                error_code="AUTH_ERROR",
                execution_id=execution_id
            )
            return format_response_for_api(response, 401)
        
        except ValueError as e:
            logger.warning(f"JWT validation error: {str(e)} (execution_id: {execution_id})")
            response = create_error_response(
                error_message="Invalid authentication token",
                error_code="AUTH_ERROR",
                execution_id=execution_id
            )
            return format_response_for_api(response, 401)
        
        except Exception as e:
            logger.error(f"Unexpected authentication error: {str(e)} (execution_id: {execution_id})")
            response = create_error_response(
                error_message="Authentication failed",
                error_code="AUTH_ERROR",
                execution_id=execution_id
            )
            return format_response_for_api(response, 401)
    
    return decorated_function
