"""Repository management routes.

All routes are protected by JWT authentication middleware.
User context is injected via Flask g object.
"""

from flask import Blueprint, request, g
from bff.middleware import governance_error_handler, generate_execution_id, require_auth
from bff.utils import create_success_response, create_error_response
from bff.services.github_service import github_service


# Create blueprint
bp = Blueprint('repos', __name__, url_prefix='/repos')


@bp.route('/', methods=['GET'])
@require_auth
@governance_error_handler
def get_repos():
    """
    GET /repos
    
    Fetch all repositories accessible to the user (owned, member, collaborator).
    
    REQUIRES: Valid JWT token in Authorization header
    
    Returns:
        StandardResponseEnvelope with list of repositories.
    """
    execution_id = generate_execution_id()
    user_id = g.user_id
    
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Fetching repos for user {user_id} (execution_id: {execution_id})")
        
        repos = github_service.get_user_repos(user_id)
        
        # Simplify the repo list for the frontend
        simplified_repos = [
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "html_url": r.get("html_url"),
                "private": r.get("private"),
                "permissions": r.get("permissions", {})
            } for r in repos
        ]
        
        response = create_success_response(
            data={"repositories": simplified_repos},
            execution_id=execution_id
        )
        return response, 200
        
    except ValueError as e:
        logger.error(f"Error fetching repos: {str(e)}")
        response = create_error_response(
            error_message=str(e),
            error_code="NOT_FOUND",
            execution_id=execution_id
        )
        return response, 404
    except Exception as e:
        logger.error(f"Unexpected error fetching repos: {str(e)}")
        response = create_error_response(
            error_message="Failed to fetch repositories",
            error_code="INTERNAL_ERROR",
            execution_id=execution_id
        )
        return response, 500


@bp.route('/connect', methods=['POST'])
@require_auth
@governance_error_handler
def connect_repo():
    """
    POST /repos/connect
    
    Connect and link a GitHub repository to the NexusOps system.
    
    REQUIRES: Valid JWT token in Authorization header
    Format: Authorization: Bearer {token}
    
    User context injected by @require_auth decorator:
    - g.user_id: Authenticated user's UUID
    - g.user_email: Authenticated user's email
    
    Request body:
        {
            "code": "github_oauth_code",
            "repo_url": "https://github.com/owner/repo"
        }
    
    VALIDATION FLOW:
    1. Extract OAuth code and repo URL
    2. Exchange code for GitHub access token
    3. Verify user has access to repository
    4. Check token has required scopes (repo, read:user)
    5. Prevent duplicate repo linking (unique per user)
    6. Store encrypted token in GitHubTokens table
    
    Returns:
        StandardResponseEnvelope: {
            "success": true,
            "data": {
                "user_id": "...",
                "repo_url": "...",
                "repo_name": "repo",
                "repo_owner": "owner",
                "connected": true,
                "scopes": ["repo", "read:user"]
            },
            "error": null,
            "meta": {"execution_id": "...", "stage": "ASK"}
        }
        
    Error Cases:
    - 400: Missing or invalid code/repo_url
    - 401: GitHub authentication failure
    - 403: User lacks access to repository
    - 409: Repository already linked to another user
    - 500: Internal error
    """
    execution_id = generate_execution_id()
    
    try:
        # Parse request body
        body = request.get_json() or {}
        code = body.get('code')
        repo_url = body.get('repo_url')
        
        # Validate inputs
        if not code or not isinstance(code, str):
            response = create_error_response(
                error_message="GitHub OAuth code is required",
                error_code="VALIDATION_ERROR",
                execution_id=execution_id
            )
            return response, 400
        
        if not repo_url or not isinstance(repo_url, str):
            response = create_error_response(
                error_message="Repository URL is required",
                error_code="VALIDATION_ERROR",
                execution_id=execution_id
            )
            return response, 400
        
        # Validate repo_url format
        if not repo_url.startswith('https://github.com/'):
            response = create_error_response(
                error_message="Invalid repository URL format",
                error_code="VALIDATION_ERROR",
                execution_id=execution_id
            )
            return response, 400
        
        # Attempt GitHub integration
        import logging
        logger = logging.getLogger(__name__)
        
        user_id = g.user_id
        logger.info(f"Connecting repo {repo_url} for user {user_id} (execution_id: {execution_id})")
        
        # Perform GitHub connection
        connection_result = github_service.connect_repository(
            user_id=user_id,
            code=code,
            repo_url=repo_url
        )
        
        response = create_success_response(
            data={
                'user_id': connection_result.get('user_id'),
                'repo_url': connection_result.get('repo_url'),
                'repo_name': connection_result.get('repo_name'),
                'repo_owner': connection_result.get('repo_owner'),
                'connected': connection_result.get('connected'),
                'scopes': connection_result.get('scopes'),
                'message': 'Repository connected successfully'
            },
            execution_id=execution_id
        )
        return response, 201
    
    except ValueError as e:
        # Validation or GitHub error
        error_msg = str(e)
        logger = logging.getLogger(__name__)
        logger.warning(f"Repository connection validation error: {error_msg}")
        
        # Determine HTTP status based on error type
        status_code = 400
        if "access" in error_msg.lower():
            status_code = 403
        elif "already linked" in error_msg.lower():
            status_code = 409
        elif "unauthorized" in error_msg.lower() or "authentication" in error_msg.lower():
            status_code = 401
        
        response = create_error_response(
            error_message=error_msg,
            error_code="REPO_CONNECT_ERROR",
            execution_id=execution_id
        )
        return response, status_code
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error connecting repository: {str(e)}")
        
        response = create_error_response(
            error_message="Failed to connect repository",
            error_code="INTERNAL_ERROR",
            execution_id=execution_id
        )
        return response, 500
