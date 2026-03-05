from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks
from bff.middleware import generate_execution_id, require_auth_fastapi
from bff.utils import create_success_response_fastapi, create_error_response_fastapi
from bff.services.orchestrator_client import invoke_orchestrator
from bff.services.github_service import github_service
from bff import config
import boto3
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/executions", tags=["executions"])

@router.post("/start")
async def start_execution(request: Request, user_id: str = Depends(require_auth_fastapi)):
    """POST /executions/start
    Enforces the full governance pipeline using FastAPI.
    """
    execution_id = generate_execution_id()
    
    try:
        body = await request.json()
    except:
        body = {}
    
    repo_id = body.get("repository_url") or body.get("repo_id")
    user_input = body.get("input", {})

    if not repo_id:
        raise HTTPException(status_code=400, detail="repository_url is required")

    access_token = github_service.token_store.get_any_token_for_user(user_id)
    if not access_token:
        return create_error_response_fastapi(
            error_message="No GitHub account linked. Please connect a repository first.",
            error_code="AUTH_ERROR",
            execution_id=execution_id
        )

    is_accessible, repo_info = github_service.oauth_service.validate_repository_access(
        access_token, repo_id
    )

    if not is_accessible:
        return create_error_response_fastapi(
            error_message="You do not have pull access to this repository.",
            error_code="AUTH_ERROR",
            execution_id=execution_id
        )

    # Invoke the Orchestrator
    envelope = invoke_orchestrator(
        user_id=user_id,
        repo_id=repo_id,
        user_input=user_input,
    )

    if not envelope.get("success", True):
        raise HTTPException(status_code=502, detail="Orchestrator invocation failed")

    return create_success_response_fastapi(
        data=envelope.get("data", {}),
        execution_id=execution_id,
        stage="ASK"
    )

@router.get("/{id}")
async def get_execution(id: str, user_id: str = Depends(require_auth_fastapi)):
    """GET /executions/{id}
    Retrieve the status and details of an execution.
    """
    execution_id = generate_execution_id()
    
    try:
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=config.AWS_REGION,
            endpoint_url=config.DYNAMODB_ENDPOINT if config.DYNAMODB_ENDPOINT else None,
        )
        table = dynamodb.Table("ExecutionRecords")
        
        response = table.get_item(Key={"execution_id": id})
        item = response.get("Item")
        
        if not item:
            return create_error_response_fastapi(
                error_message="Execution record not found",
                error_code="NOT_FOUND",
                execution_id=execution_id,
            )
            
        if item.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to execution record")
            
        return create_success_response_fastapi(
            data={
                "execution_id": item.get("execution_id"),
                "user_id": item.get("user_id"),
                "repo_id": item.get("repo_id"),
                "stage": item.get("stage"),
                "status": item.get("status"),
                "created_at": item.get("created_at"),
                "updated_at": item.get("updated_at")
            },
            execution_id=execution_id,
            stage=item.get("stage")
        )
        
    except Exception as e:
        logger.error(f"Error querying execution {id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred")
