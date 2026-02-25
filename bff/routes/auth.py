"""Authentication and authorization routes."""

from flask import Blueprint, request, jsonify
from bff import config
from bff.middleware import govenance_error_handler, generate_execution_id
from bff.utils import create_success_response, create_error_response


# Create blueprint
bp = Blueprint('auth', __name__, url_prefix='/auth')


@bp.route('/login', methods=['POST'])
@govenance_error_handler
def login():
    """
    POST /auth/login
    
    Authenticate user with credentials and return authentication token.
    
    Request body:
        {
            "username": "user@example.com",
            "password": "password"
        }
    
    Returns:
        StandardResponseEnvelope: Authentication response with token
    """
    execution_id = generate_execution_id()
    
    # In local mode, bypass authentication
    if config.AUTH_BYPASS:
        response = create_success_response(
            data={
                'token': 'mock-token-local-mode',
                'auth_bypass': True,
                'message': 'Authentication bypassed (local mode)'
            },
            execution_id=execution_id
        )
        return response, 200
    
    # In AWS mode, strict authentication
    response = create_success_response(
        data={
            'token': 'mock-token-aws-mode',
            'auth_bypass': False,
            'message': 'Authentication successful'
        },
        execution_id=execution_id
    )
    return response, 200
