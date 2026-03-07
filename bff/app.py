"""Main FastAPI application entry point for BFF.

This application is designed to simulate AWS API Gateway behavior locally,
enabling development and testing of the NexusOPS dashboard and orchestrator.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from bff.routes import execution_router, auth_router, repo_router, ws_router, dashboard_router
from bff import config
from bff.middleware import generate_execution_id
import logging
import os

# Configure logging
logging.basicConfig(level=config.LOG_LEVEL)
logger = logging.getLogger(__name__)

def create_app():
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=config.APP_NAME,
        version=config.VERSION,
        debug=config.DEBUG
    )
    
    # Configure CORS for Dashboard and Landing Page
    # Environment-specific origin restrictions
    if config.CURRENT_ENV == 'aws':
        # Production: restrict to specific domains (and localhost for testing)
        allowed_origins = [
            "https://dashboard.nexusops.ai",
            "https://nexusops.ai",
            "https://www.nexusops.ai",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ]
    else:
        # Local development: allow localhost
        allowed_origins = [
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000"
        ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    from fastapi.responses import JSONResponse

    @app.get("/")
    async def root():
        return JSONResponse(content={
            "service": "NexusOPS BFF",
            "status": "online",
            "version": config.VERSION
        })

    # Register routers
    app.include_router(execution_router)
    app.include_router(auth_router)
    app.include_router(repo_router)
    app.include_router(ws_router)
    app.include_router(dashboard_router)
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "success": True,
            "data": {
                "service": config.APP_NAME,
                "version": config.VERSION,
                "environment": config.CURRENT_ENV,
                "auth_bypass": config.AUTH_BYPASS
            },
            "meta": {
                "execution_id": generate_execution_id(),
                "stage": "ASK"
            }
        }
    
    return app

# Create the application instance
app = create_app()

# AWS Lambda Handler (Mangum adapter for API Gateway)
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    logger.warning("Mangum not installed, Lambda handler not available")
    handler = None

if __name__ == '__main__':
    import uvicorn
    # Only watch the bff/ directory for changes (not dashboard/landing-page)
    bff_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)))
    uvicorn.run(
        "bff.app:app",
        host='0.0.0.0',
        port=8000,
        reload=config.DEBUG,
        reload_dirs=[bff_dir] if config.DEBUG else None
    )
