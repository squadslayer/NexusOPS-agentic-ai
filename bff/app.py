"""Main Flask application entry point for BFF.

This application is strictly designed to simulate AWS API Gateway behavior locally,
allowing development and testing without deploying to AWS every time.

All responses are governed by StandardResponseEnvelope with strict error masking.
"""

from flask import Flask
from bff.routes import execution, auth, repo
from bff import config
from bff.middleware import register_error_handlers, govenance_error_handler, generate_execution_id
from bff.utils import create_success_response


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Load configuration based on environment
    app.config['DEBUG'] = config.DEBUG
    app.config['TESTING'] = config.TESTING
    app.config['ENV'] = config.CURRENT_ENV
    
    # Register route blueprints
    app.register_blueprint(execution.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(repo.bp)
    
    # Register global error handlers (govenance rules)
    register_error_handlers(app)
    
    return app


# Create the application instance
app = create_app()


@app.route('/health', methods=['GET'])
@govenance_error_handler
def health_check():
    """Health check endpoint to verify the API is running."""
    response = create_success_response(
        data={
            'service': 'NexusOps BFF',
            'environment': config.CURRENT_ENV,
            'auth_bypass': config.AUTH_BYPASS
        },
        execution_id=generate_execution_id()
    )
    return response, 200


if __name__ == '__main__':
    # Run the Flask app in local development mode
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=config.DEBUG
    )
