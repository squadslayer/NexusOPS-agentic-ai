"""Main Flask application entry point for BFF.

This application is strictly designed to simulate AWS API Gateway behavior locally,
allowing development and testing without deploying to AWS every time.
"""

from flask import Flask
from bff.routes import execution, auth, repo
from bff import config


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
    
    return app


# Create the application instance
app = create_app()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the API is running."""
    return {
        'status': 'healthy',
        'service': 'NexusOps BFF',
        'environment': config.CURRENT_ENV,
        'auth_bypass': config.AUTH_BYPASS
    }, 200


if __name__ == '__main__':
    # Run the Flask app in local development mode
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=config.DEBUG
    )
