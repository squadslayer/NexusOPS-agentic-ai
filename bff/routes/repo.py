from fastapi import APIRouter, Request, Depends, HTTPException
from bff.middleware import generate_execution_id, require_auth_fastapi
from bff.utils import create_success_response_fastapi, create_error_response_fastapi
from bff.services.github_service import github_service
from bff.repositories.repo_repository import RepoRepository
from bff.models.repository import Repository, RepositoryStatus
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
async def get_repos(request: Request, user_id: str = Depends(require_auth_fastapi)):
    """
    GET /repos
    Fetch all CONNECTED repositories for the user from DynamoDB.
    """
    execution_id = generate_execution_id()
    repo_repo = RepoRepository()
    
    try:
        # Fetch from persistent storage
        connected_repos = repo_repo.get_user_repositories(user_id)
        
        simplified_repos = [
            {
                "id": r.repo_id,
                "name": r.repo_name,
                "full_name": r.repo_name, # In this context
                "html_url": r.repo_url,
                "status": r.status,
                "connected_at": r.connected_at.isoformat()
            } for r in connected_repos
        ]
        
        return create_success_response_fastapi(
            data={"repositories": simplified_repos},
            execution_id=execution_id
        )
        
    except Exception as e:
        logger.error(f"Error fetching connected repos for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch repositories")

@router.get("/available")
async def get_available_repos(user_id: str = Depends(require_auth_fastapi)):
    """
    GET /repos/available
    Fetch all repositories accessible to the user from GitHub API.
    """
    execution_id = generate_execution_id()
    
    try:
        repos = github_service.get_user_repos(user_id)
        
        simplified_repos = [
            {
                "id": str(r.get("id")),
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "html_url": r.get("html_url"),
                "private": r.get("private")
            } for r in repos
        ]
        
        return create_success_response_fastapi(
            data={"repositories": simplified_repos},
            execution_id=execution_id
        )
    except Exception as e:
        logger.error(f"Error fetching available repos for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch available repositories")


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
        
        if not repo_url:
            raise HTTPException(status_code=400, detail="repo_url is required")
        
        connection_result = github_service.connect_repository(
            user_id=user_id,
            repo_url=repo_url,
            code=code
        )

        # PERSIST connection in Repositories table
        repo_repo = RepoRepository()
        repo_data = Repository(
            user_id=user_id,
            repo_id=str(connection_result.get('repo_id', hash(repo_url))), # fallback if id missing
            repo_name=connection_result.get('repo_name'),
            repo_url=repo_url,
            default_branch="main", # Should ideally come from repo_info
            status=RepositoryStatus.READY
        )
        repo_repo.store_repository(repo_data)
        
        return create_success_response_fastapi(
            data={
                'user_id': user_id,
                'repo_url': repo_url,
                'repo_name': connection_result.get('repo_name'),
                'connected': True,
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
