"""Authentication and authorization routes."""

from flask import Blueprint, request, jsonify
from bff import config


# Create blueprint
bp = Blueprint('auth', __name__, url_prefix='/auth')


@bp.route('/login', methods=['POST'])
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
        dict: JSON response with auth status and token info
    """
    # In local mode, bypass authentication
    if config.AUTH_BYPASS:
        return jsonify({
            'status': 'ok',
            'route': 'login',
            'method': 'POST',
            'endpoint': '/auth/login',
            'message': 'Authentication bypassed (local mode)',
            'token': 'mock-token-local-mode',
            'auth_bypass': True
        }), 200
    
    # In AWS mode, strict authentication
    return jsonify({
        'status': 'ok',
        'route': 'login',
        'method': 'POST',
        'endpoint': '/auth/login',
        'message': 'Authentication successful',
        'token': 'mock-token-aws-mode',
        'auth_bypass': False
    }), 200
