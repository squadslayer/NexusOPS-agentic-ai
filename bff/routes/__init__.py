"""Routes package for BFF.

This package contains all the route blueprints for the API endpoints,
mimicking AWS API Gateway behavior locally.
"""

from .execution import router as execution_router
from .auth import router as auth_router
from .repo import router as repo_router
from .ws import router as ws_router

__all__ = ['execution_router', 'auth_router', 'repo_router', 'ws_router']
