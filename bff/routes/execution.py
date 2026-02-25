"""Execution routes for triggering workflows and operations."""

from flask import Blueprint, request, jsonify
from bff.middleware import govenance_error_handler, generate_execution_id
from bff.utils import create_success_response, create_error_response


# Create blueprint
bp = Blueprint('executions', __name__, url_prefix='/executions')


@bp.route('/start', methods=['POST'])
@govenance_error_handler
def start_execution():
    """
    POST /executions/start
    
    Trigger the start of a new execution workflow.
    
    Returns:
        StandardResponseEnvelope: JSON response with execution status
    """
    execution_id = generate_execution_id()
    response = create_success_response(
        data={
            'execution_id': execution_id,
            'status': 'started',
            'message': 'Execution workflow started successfully'
        },
        execution_id=execution_id
    )
    return response, 202


@bp.route('/<id>', methods=['GET'])
@govenance_error_handler
def get_execution(id):
    """
    GET /executions/{id}
    
    Retrieve the status and details of an execution by ID.
    
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
            'stage': 'ASK'
        },
        execution_id=execution_id
    )
    return response, 200
