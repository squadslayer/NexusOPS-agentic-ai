"""Execution routes for triggering workflows and operations."""

from flask import Blueprint, request, jsonify


# Create blueprint
bp = Blueprint('executions', __name__, url_prefix='/executions')


@bp.route('/start', methods=['POST'])
def start_execution():
    """
    POST /executions/start
    
    Trigger the start of a new execution workflow.
    
    Returns:
        dict: JSON response with status and route info
    """
    return jsonify({
        'status': 'ok',
        'route': 'execution_start',
        'method': 'POST',
        'endpoint': '/executions/start',
        'message': 'Execution workflow started successfully'
    }), 202


@bp.route('/<id>', methods=['GET'])
def get_execution(id):
    """
    GET /executions/{id}
    
    Retrieve the status and details of an execution by ID.
    
    Args:
        id (str): The execution ID
    
    Returns:
        dict: JSON response with execution status and details
    """
    return jsonify({
        'status': 'ok',
        'route': 'get_execution',
        'method': 'GET',
        'endpoint': f'/executions/{id}',
        'execution_id': id,
        'message': 'Execution details retrieved successfully'
    }), 200
