"""Execution routes for triggering workflows and operations."""

from flask import Blueprint, request, jsonify, g
from bff.middleware import governance_error_handler, generate_execution_id, require_auth
from bff.utils import create_success_response, create_error_response


# Create blueprint
bp = Blueprint('executions', __name__, url_prefix='/executions')


@bp.route('/start', methods=['POST'])
@require_auth
@governance_error_handler
def start_execution():
    """
    POST /executions/start
    
    Trigger the start of a new execution workflow.
    
    REQUIRES: Valid JWT token in Authorization header
    Format: Authorization: Bearer {token}
    
    User context injected by @require_auth decorator:
    - g.user_id: Authenticated user's UUID
    - g.user_email: Authenticated user's email
    
    Returns:
        StandardResponseEnvelope: JSON response with execution status
    """
    execution_id = generate_execution_id()
    response = create_success_response(
        data={
            'execution_id': execution_id,
            'status': 'started',
            'message': 'Execution workflow started successfully',
            'triggered_by': g.user_id
        },
        execution_id=execution_id
    )
    return response, 202


@bp.route('/<id>', methods=['GET'])
@require_auth
@governance_error_handler
def get_execution(id):
    """
    GET /executions/{id}
    
    Retrieve the status and details of an execution by ID.
    
    REQUIRES: Valid JWT token in Authorization header
    Format: Authorization: Bearer {token}
    
    User context injected by @require_auth decorator:
    - g.user_id: Authenticated user's UUID
    - g.user_email: Authenticated user's email
    
    Args:
        id (str): The execution ID
    
    Returns:
        StandardResponseEnvelope: Execution status and details
    """
    execution_id = generate_execution_id()
    response = create_success_response(
        data={
            'execution_id': id,
            'status': 'completed',
            'message': 'Execution details retrieved successfully',
            'stage': 'ASK',
            'requested_by': g.user_id
        },
        execution_id=execution_id
    )
    return response, 200
