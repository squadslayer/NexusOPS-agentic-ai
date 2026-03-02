"""Authentication and authorization routes."""

from flask import Blueprint, request, jsonify, g
from bff import config
from bff.middleware import governance_error_handler, generate_execution_id, require_auth
from bff.utils import create_success_response, create_error_response
from bff.services.auth_service import auth_service


# Create blueprint
bp = Blueprint('auth', __name__, url_prefix='/auth')


@bp.route('/login', methods=['POST'])
@governance_error_handler
def login():
    """
    POST /auth/login
    
    Authenticate user with credentials and return authentication token.
    
    Request body:
        {
            "email": "user@example.com",
            "password": "password" (optional in local mode)
        }
    
    AUTHENTICATION FLOW:
    1. Extract email from request body
    2. In local mode (AUTH_BYPASS=True):
       - Create mock user and token
    3. In AWS mode (AUTH_BYPASS=False):
       - Create user in DynamoDB if new
       - Generate JWT token
    4. Return token in StandardResponseEnvelope
    
    Returns:
        StandardResponseEnvelope: {
            "success": true,
            "data": {
                "user_id": "uuid",
                "email": "user@example.com",
                "token": "jwt_token",
                "created": boolean
            },
            "error": null,
            "meta": {"execution_id": "...", "stage": "ASK"}
        } | 401 if invalid
    """
    execution_id = generate_execution_id()
    
    try:
        # Parse request body
        body = request.get_json() or {}
        email = body.get('email')
        
        # Validate email
        if not email or not isinstance(email, str) or '@' not in email:
            response = create_error_response(
                error_message="Valid email address is required",
                error_code="VALIDATION_ERROR",
                execution_id=execution_id
            )
            return response, 400
        
        # In local mode, bypass authentication
        if config.AUTH_BYPASS:
            import uuid
            mock_user_id = str(uuid.uuid4())
            response = create_success_response(
                data={
                    'user_id': mock_user_id,
                    'email': email,
                    'token': 'mock-token-local-mode',
                    'auth_bypass': True,
                    'message': 'Authentication bypassed (local mode)',
                    'created': True
                },
                execution_id=execution_id
            )
            return response, 200
        
        # In AWS mode, use authentication service
        auth_result = auth_service.login(email=email)
        
        response = create_success_response(
            data={
                'user_id': auth_result['user_id'],
                'email': auth_result['email'],
                'token': auth_result['token'],
                'created': auth_result['created'],
                'message': 'Authentication successful'
            },
            execution_id=execution_id
        )
        return response, 200
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Login error: {str(e)}")
        
        response = create_error_response(
            error_message="Authentication failed",
            error_code="AUTH_ERROR",
            execution_id=execution_id
        )
        return response, 500


@bp.route('/verify', methods=['POST'])
@require_auth
@governance_error_handler
def verify_token():
    """
    POST /auth/verify
    
    Verify that the current authentication token is valid.
    
    REQUIRES: Valid JWT token in Authorization header
    Format: Authorization: Bearer {token}
    
    Returns:
        StandardResponseEnvelope: {
            "success": true,
            "data": {
                "user_id": "...",
                "email": "...",
                "valid": true
            },
            "error": null,
            "meta": {"execution_id": "...", "stage": "ASK"}
        } | 401 if invalid
    """
    execution_id = generate_execution_id()
    
    response = create_success_response(
        data={
            'user_id': g.user_id,
            'email': g.user_email,
            'valid': True,
            'message': 'Token is valid'
        },
        execution_id=execution_id
    )
    return response, 200
