from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks
from bff.middleware import generate_execution_id, require_auth_fastapi
from bff.utils import create_success_response_fastapi, create_error_response_fastapi
from bff.services.orchestrator_client import invoke_orchestrator
from bff.services.github_service import github_service
from bff.repositories.execution_repository import ExecutionRepository
from bff.models.execution import ExecutionRecord, ExecutionStatus
from bff import config
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

    # Step 3: Create persistent execution record
    exec_repo = ExecutionRepository()
    record = ExecutionRecord(
        user_id=user_id,
        execution_id=execution_id,
        repo_id=repo_id,
        status=ExecutionStatus.PENDING,
        prompt=user_input.get("prompt", "")
    )
    exec_repo.create_execution(record)
    logger.info(f"Persistent execution record created: {execution_id}")

    # Step 4: Invoke the Orchestrator
    try:
        envelope = invoke_orchestrator(
            user_id=user_id,
            repo_id=repo_id,
            user_input=user_input,
        )
    except Exception as e:
        # Fail the execution in DB if invocation fails
        exec_repo.update_execution_status(user_id, execution_id, ExecutionStatus.FAILED, {"error": str(e)})
        raise HTTPException(status_code=502, detail="Orchestrator invocation failed")

    return create_success_response_fastapi(
        data={
            "execution_id": execution_id,
            "status": ExecutionStatus.PENDING,
            "message": "Analysis started successfully"
        },
        execution_id=execution_id,
        stage="ASK"
    )

@router.get("/{id}")
async def get_execution_route(id: str, user_id: str = Depends(require_auth_fastapi)):
    """GET /executions/{id}
    Retrieve the status and details of an execution using DAL.
    """
    execution_id = generate_execution_id()
    exec_repo = ExecutionRepository()
    
    try:
        record = exec_repo.get_execution(id)
        
        if not record:
            return create_error_response_fastapi(
                error_message="Execution record not found",
                error_code="NOT_FOUND",
                execution_id=execution_id,
            )
            
        if record.user_id != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to execution record")
            
        return create_success_response_fastapi(
            data=record.model_dump(),
            execution_id=execution_id
        )
        
    except Exception as e:
        logger.error(f"Error querying execution {id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred")
