"""Global error-handling middleware for Track 2: API Contract Design.

This middleware enforces strict governance rules across all API responses:
- No raw Lambda responses are ever returned
- No AWS error leakage (mask DynamoDB, IAM, internal server errors)
- Every request (success or failed) is formatted using StandardResponseEnvelope
"""

import logging
import traceback
import uuid
from functools import wraps
from flask import request, jsonify
from bff.utils.response_envelope import (
    create_success_response,
    create_error_response,
    mask_aws_error,
    StandardResponseEnvelope
)

logger = logging.getLogger(__name__)


def generate_execution_id():
    """Generate a unique execution ID for tracking."""
    return str(uuid.uuid4())


def format_response_for_api(response: StandardResponseEnvelope, status_code: int = 200):
    """
    Format a StandardResponseEnvelope into a Flask-compatible JSON response.
    
    Args:
        response (StandardResponseEnvelope): The response envelope
        status_code (int): HTTP status code
        
    Returns:
        tuple: (jsonified response, status_code)
    """
    return jsonify(response.to_dict()), status_code


def govenance_error_handler(f):
    """
    Decorator that wraps all route handlers with strict error governance.
    
    GOVERNANCE RULES ENFORCED:
    1. No raw Lambda responses are ever returned
    2. All errors are masked (no AWS leakage)
    3. All responses use StandardResponseEnvelope
    
    Usage:
        @app.route('/api/endpoint')
        @govenance_error_handler
        def my_endpoint():
            return create_success_response(
                data={'result': 'success'},
                execution_id=generate_execution_id()
            )
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        execution_id = generate_execution_id()
        
        try:
            # Execute the route handler
            result = f(*args, **kwargs)
            
            # If the result is already a StandardResponseEnvelope, format it
            if isinstance(result, StandardResponseEnvelope):
                return format_response_for_api(result, 200)
            
            # If it's a tuple with StandardResponseEnvelope and status code
            if isinstance(result, tuple) and len(result) == 2:
                envelope, status_code = result
                if isinstance(envelope, StandardResponseEnvelope):
                    return format_response_for_api(envelope, status_code)
            
            # Fallback: wrap any other response (log warning)
            logger.warning(
                f"Route {request.endpoint} returned non-StandardResponseEnvelope response. "
                f"Wrapping automatically (execution_id: {execution_id})"
            )
            
            if isinstance(result, tuple):
                data, status = result
                response = create_success_response(
                    data=data if isinstance(data, dict) else {'result': str(data)},
                    execution_id=execution_id
                )
                return format_response_for_api(response, status)
            
            response = create_success_response(
                data={'result': str(result)},
                execution_id=execution_id
            )
            return format_response_for_api(response, 200)
        
        except Exception as e:
            # Log the actual error internally (never expose to user)
            logger.error(
                f"Error in route {request.endpoint} (execution_id: {execution_id})\n"
                f"Error: {type(e).__name__}: {str(e)}\n"
                f"Traceback:\n{traceback.format_exc()}",
                exc_info=True
            )
            
            # Mask the error and return safe response
            safe_message, error_code = mask_aws_error(e)
            
            response = create_error_response(
                error_message=safe_message,
                error_code=error_code,
                execution_id=execution_id
            )
            
            # Use appropriate HTTP status code
            status_code = 500
            if error_code == "VALIDATION_ERROR":
                status_code = 400
            elif error_code == "AUTH_ERROR":
                status_code = 403
            elif error_code == "NOT_FOUND":
                status_code = 404
            
            return format_response_for_api(response, status_code)
    
    return decorated_function


def register_error_handlers(app):
    """
    Register global Flask error handlers to enforce governance rules.
    
    This function should be called when the app is created:
    
        app = Flask(__name__)
        register_error_handlers(app)
    
    Args:
        app (Flask): The Flask application instance
    """
    
    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 Bad Request errors."""
        execution_id = generate_execution_id()
        response = create_error_response(
            error_message="Invalid request format",
            error_code="VALIDATION_ERROR",
            execution_id=execution_id
        )
        return format_response_for_api(response, 400)
    
    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 Forbidden errors."""
        execution_id = generate_execution_id()
        response = create_error_response(
            error_message="Access denied",
            error_code="AUTH_ERROR",
            execution_id=execution_id
        )
        return format_response_for_api(response, 403)
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 Not Found errors."""
        execution_id = generate_execution_id()
        response = create_error_response(
            error_message="Resource not found",
            error_code="NOT_FOUND",
            execution_id=execution_id
        )
        return format_response_for_api(response, 404)
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 Internal Server errors."""
        execution_id = generate_execution_id()
        
        # Log the actual error
        logger.error(
            f"Internal server error (execution_id: {execution_id})\n"
            f"Error: {str(error)}\n"
            f"Traceback:\n{traceback.format_exc()}",
            exc_info=True
        )
        
        # Return masked error
        safe_message, error_code = mask_aws_error(error)
        response = create_error_response(
            error_message=safe_message,
            error_code=error_code,
            execution_id=execution_id
        )
        return format_response_for_api(response, 500)
    
    @app.errorhandler(Exception)
    def unhandled_exception(error):
        """Handle any unhandled exceptions."""
        execution_id = generate_execution_id()
        
        # Log the actual error
        logger.error(
            f"Unhandled exception (execution_id: {execution_id})\n"
            f"Error: {type(error).__name__}: {str(error)}\n"
            f"Traceback:\n{traceback.format_exc()}",
            exc_info=True
        )
        
        # Mask the error
        safe_message, error_code = mask_aws_error(error)
        response = create_error_response(
            error_message=safe_message,
            error_code=error_code,
            execution_id=execution_id
        )
        return format_response_for_api(response, 500)
    
    logger.info("Global error handlers registered successfully")
