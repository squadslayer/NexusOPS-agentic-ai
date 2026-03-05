from fastapi import APIRouter, Request, Depends, HTTPException
from bff.middleware import generate_execution_id, require_auth_fastapi
from bff.utils import create_success_response_fastapi, create_error_response_fastapi
from bff.services.github_service import github_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repos", tags=["repos"])


@router.get("/authorize")
async def authorize_github(user_id: str = Depends(require_auth_fastapi)):
    """
    GET /repos/authorize
    Get the GitHub OAuth authorization URL to initiate the connection flow.
    """
    execution_id = generate_execution_id()
    state = generate_execution_id()
    
    url = github_service.oauth_service.get_authorization_url(state)
    
    return create_success_response_fastapi(
        data={"oauth_url": url},
        execution_id=execution_id
    )


@router.get("/")
async def get_repos(user_id: str = Depends(require_auth_fastapi)):
    """
    GET /repos
    Fetch all repositories accessible to the user.
    """
    execution_id = generate_execution_id()
    
    try:
        repos = github_service.get_user_repos(user_id)
        
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
        
        return create_success_response_fastapi(
            data={"repositories": simplified_repos},
            execution_id=execution_id
        )
        
    except Exception as e:
        logger.error(f"Error fetching repos for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch repositories")


@router.post("/connect")
async def connect_repo(request: Request, user_id: str = Depends(require_auth_fastapi)):
    """
    POST /repos/connect
    Connect and link a GitHub repository.
    """
    execution_id = generate_execution_id()
    
    try:
        body = await request.json()
        code = body.get('code')
        repo_url = body.get('repo_url')
        
        if not code or not repo_url:
            raise HTTPException(status_code=400, detail="code and repo_url are required")
        
        connection_result = github_service.connect_repository(
            user_id=user_id,
            code=code,
            repo_url=repo_url
        )
        
        return create_success_response_fastapi(
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
    
    except ValueError as e:
        error_msg = str(e)
        status_code = 400
        if "access" in error_msg.lower(): status_code = 403
        elif "already linked" in error_msg.lower(): status_code = 409
        elif "unauthorized" in error_msg.lower(): status_code = 401
        
        return create_error_response_fastapi(
            error_message=error_msg,
            error_code="REPO_CONNECT_ERROR",
            execution_id=execution_id
        )
    
    except Exception as e:
        logger.error(f"Error connecting repo for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
