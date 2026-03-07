from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks
from bff.middleware import generate_execution_id, require_auth_fastapi, check_rate_limit
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
    check_rate_limit(user_id, limit=10, window=60)
    
    execution_id = generate_execution_id()
    
    try:
        body = await request.json()
    except:
        body = {}
    
    repo_id = body.get("repository_url") or body.get("repo_id")
    user_input = body.get("input", {})

    if not repo_id:
        raise HTTPException(status_code=400, detail="repository_url is required")

    access_token = "mock-token" if config.AUTH_BYPASS else github_service.token_store.get_any_token_for_user(user_id)
    if not access_token:
        return create_error_response_fastapi(
            error_message="No GitHub account linked. Please connect a repository first.",
            error_code="AUTH_ERROR",
            execution_id=execution_id
        )

    if config.AUTH_BYPASS:
        is_accessible, repo_info = True, {"id": "mock-repo-12345", "name": "nexusops-core"}
    else:
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
    if not exec_repo.create_execution(record):
        return create_error_response_fastapi(
            error_message="Failed to initialize execution record in database.",
            error_code="DB_ERROR",
            execution_id=execution_id
        )
    logger.info(f"Persistent execution record created: {execution_id}")

    # Step 4: Invoke the Orchestrator
    try:
        envelope = invoke_orchestrator(
            user_id=user_id,
            repo_id=repo_id,
            execution_id=execution_id,
            user_input=user_input,
        )
    except Exception as e:
        # Fail the execution in DB if invocation fails
        exec_repo.update_execution_status(user_id, execution_id, ExecutionStatus.FAILED, {"error": str(e)})
        raise HTTPException(status_code=502, detail="Orchestrator invocation failed")

    response_data = {
        "execution_id": execution_id,
        "status": ExecutionStatus.PENDING,
        "message": "Analysis started successfully"
    }
    logger.info(f"Returning success for execution {execution_id}: {response_data}")
    
    return create_success_response_fastapi(
        data=response_data,
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
        record = exec_repo.get_execution(user_id, id)
        
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

@router.get("")
async def list_executions(repo_id: str = None, status: str = None, user_id: str = Depends(require_auth_fastapi)):
    """GET /executions
    Retrieve a list of executions, filtered by repo_id or status using GSIs.
    """
    execution_id = generate_execution_id()
    exec_repo = ExecutionRepository()
    
    try:
        if repo_id:
            records = exec_repo.get_executions_by_repo(user_id, repo_id)
        elif status:
            try:
                status_enum = ExecutionStatus(status.upper())
            except ValueError:
                return create_error_response_fastapi(
                    error_message=f"Invalid status: {status}",
                    error_code="VALIDATION_ERROR",
                    execution_id=execution_id
                )
            records = exec_repo.get_executions_by_status(user_id, status_enum)
        else:
            # Fallback: get all executions for the user
            records = exec_repo.get_all_executions(user_id)
            
        return create_success_response_fastapi(
            data=[record.model_dump() for record in records],
            execution_id=execution_id
        )
            
    except Exception as e:
        logger.error(f"Error querying executions list: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred")

@router.get("/{id}/logs")
async def get_execution_logs(id: str, user_id: str = Depends(require_auth_fastapi)):
    """GET /executions/{id}/logs
    Retrieve logs for a specific execution.
    """
    execution_id = generate_execution_id()
    exec_repo = ExecutionRepository()
    
    try:
        record = exec_repo.get_execution(user_id, id)
        if not record:
            return create_error_response_fastapi("Execution not found", "NOT_FOUND", execution_id)
            
        # For now, return an empty array or mocked logs if CloudWatch integration isn't fully ready
        # In a real implementation this would query CloudWatch Logs for the execution ID
        return create_success_response_fastapi(
            data={"logs": []},
            execution_id=execution_id
        )
    except Exception as e:
        logger.error(f"Error retrieving logs for {id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving logs")

@router.get("/{id}/approval")
async def get_execution_approval(id: str, user_id: str = Depends(require_auth_fastapi)):
    """GET /executions/{id}/approval
    Retrieve the pending or answered approval record.
    """
    execution_id = generate_execution_id()
    exec_repo = ExecutionRepository()
    
    try:
        record = exec_repo.get_execution(user_id, id)
        if not record:
            return create_error_response_fastapi("Execution not found", "NOT_FOUND", execution_id)
            
        approval = exec_repo.get_approval_by_execution(id)
        if not approval:
            # It's not necessarily an error if there's no approval record (e.g. execution just started)
            # But the dashboard looks for it. Let's return a success response with None data for gracefully handling it
            return create_success_response_fastapi(data=None, execution_id=execution_id)
            
        return create_success_response_fastapi(
            data=approval,
            execution_id=execution_id
        )
    except Exception as e:
        logger.error(f"Error retrieving approval for {id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred")

@router.post("/{id}/approve")
async def approve_execution(id: str, user_id: str = Depends(require_auth_fastapi)):
    """POST /executions/{id}/approve"""
    execution_id = generate_execution_id()
    exec_repo = ExecutionRepository()
    
    try:
        record = exec_repo.get_execution(user_id, id)
        if not record:
            return create_error_response_fastapi("Execution not found", "NOT_FOUND", execution_id)
            
        approval = exec_repo.get_approval_by_execution(id)
        if not approval:
            return create_error_response_fastapi("No approval record found", "NOT_FOUND", execution_id)
            
        updated = exec_repo.update_approval_status(approval['approval_id'], "APPROVED")
        
        # In full implementation, we would send an SQS message to wake the Orchestrator up to ACT.
        return create_success_response_fastapi(
            data=updated,
            execution_id=execution_id
        )
    except Exception as e:
        if e.__class__.__name__ == 'ConditionalCheckFailedException':
             raise HTTPException(status_code=409, detail="Approval already resolved or expired")
        logger.error(f"Error approving execution {id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred")

@router.post("/{id}/reject")
async def reject_execution(id: str, user_id: str = Depends(require_auth_fastapi)):
    """POST /executions/{id}/reject"""
    execution_id = generate_execution_id()
    exec_repo = ExecutionRepository()
    
    try:
        record = exec_repo.get_execution(user_id, id)
        if not record:
            return create_error_response_fastapi("Execution not found", "NOT_FOUND", execution_id)
            
        approval = exec_repo.get_approval_by_execution(id)
        if not approval:
            return create_error_response_fastapi("No approval record found", "NOT_FOUND", execution_id)
            
        updated = exec_repo.update_approval_status(approval['approval_id'], "REJECTED")
        
        # Also fail the execution record
        exec_repo.update_execution_status(user_id, id, ExecutionStatus.FAILED, {"error": "Plan was rejected by user"})
        
        return create_success_response_fastapi(
            data=updated,
            execution_id=execution_id
        )
    except Exception as e:
        if e.__class__.__name__ == 'ConditionalCheckFailedException':
             raise HTTPException(status_code=409, detail="Approval already resolved or expired")
        logger.error(f"Error rejecting execution {id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred")
