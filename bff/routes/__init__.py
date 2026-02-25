"""Routes package for BFF.

This package contains all the route blueprints for the API endpoints,
mimicking AWS API Gateway behavior locally.
"""

from . import execution, auth, repo

__all__ = ['execution', 'auth', 'repo']
