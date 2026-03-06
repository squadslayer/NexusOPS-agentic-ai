from fastapi import APIRouter, Depends, HTTPException
from bff.middleware import require_auth_fastapi, generate_execution_id
from bff.utils import create_success_response_fastapi, create_error_response_fastapi
from bff.repositories.execution_repository import ExecutionRepository
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(user_id: str = Depends(require_auth_fastapi)):
    """GET /dashboard/stats
    Returns aggregate statistics for the dashboard.
    """
    execution_id = generate_execution_id()
    exec_repo = ExecutionRepository()
    
    try:
        # In a real app we'd use a more optimized counter or GSI query 
        # DynamoDB doesn't do "COUNT(*)" easily without scanning, 
        # so for this execution we'll query by user ID (which returning all is acceptable for MVP)
        # Assuming we can get all executions by user_id
        response = exec_repo.table.query(
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": user_id}
        )
        
        items = response.get('Items', [])
        
        total_executions = len(items)
        pending_approvals = sum(1 for item in items if item.get('status') == 'APPROVAL_PENDING')
        failed = sum(1 for item in items if item.get('status') == 'FAILED')
        completed = sum(1 for item in items if item.get('status') == 'COMPLETED')
        
        stats = {
            "total_executions": total_executions,
            "pending_approvals": pending_approvals,
            "failed_executions": failed,
            "completed_executions": completed,
            "success_rate": round(completed / total_executions * 100, 1) if total_executions > 0 else 0
        }
        
        return create_success_response_fastapi(
            data=stats,
            execution_id=execution_id
        )
    except Exception as e:
        logger.error(f"Error generating dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error occurred")
