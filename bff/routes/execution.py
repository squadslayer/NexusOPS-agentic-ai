"""Execution routes for triggering orchestrator workflows.

Track 5 + Track 6 integration:
  POST /executions/start now enforces the full governance pipeline:
    @require_auth  → Track 3 JWT auth
    @audit_log     → Track 6 structured request logging
    @rate_limit    → Track 6 anti-spam (5 req/min/user)
    @validate_execution_request → Track 6 schema gatekeeper
    @governance_error_handler   → Track 2 error normalisation
    → repo verification (Track 4) → orchestrator invocation (Track 5)
"""

import boto3
from flask import Blueprint, request, g
from botocore.exceptions import ClientError
from bff import config
from bff.middleware import (
    governance_error_handler,
    generate_execution_id,
    require_auth,
    rate_limit,
    validate_execution_request,
)
from bff.middleware.error_handler import format_response_for_api
from bff.utils import create_success_response, create_error_response
from bff.utils.logger import audit_log
from bff.services.orchestrator_client import invoke_orchestrator
from bff.services.github_service import github_service

# Create blueprint
bp = Blueprint('executions', __name__, url_prefix='/executions')


@bp.route('/start', methods=['POST'])
@require_auth
@audit_log
@rate_limit
@validate_execution_request
@governance_error_handler
def start_execution():
    """POST /executions/start

    Full governance pipeline:
      1. JWT authentication           (@require_auth  — Track 3)
      2. Audit logging                (@audit_log     — Track 6)
      3. Rate limiting                (@rate_limit    — Track 6)
      4. Request schema validation    (@validate_execution_request — Track 6)
      5. Error normalisation          (@governance_error_handler — Track 2)
      6. Repo ownership verification  (Track 4)
      7. Orchestrator invocation      (Track 5)

    Request JSON body::

        {
            "repo_id": "https://github.com/owner/repo",
            "input": {}           // optional free-form payload
        }

    Returns:
        StandardResponseEnvelope with ``meta.stage == "ASK"``, HTTP 202.
    """
    execution_id = g.get("execution_id") or generate_execution_id()

    # ------------------------------------------------------------------
    # Body already validated by @validate_execution_request
    # ------------------------------------------------------------------
    body = request.get_json(silent=True) or {}
    repo_id = body.get("repo_id")
    user_input = body.get("input", {})

    # ------------------------------------------------------------------
    # Verify the user has PULL access to the repo (Track 4 / Phase 11)
    # ------------------------------------------------------------------
    user_id = g.user_id

    access_token = github_service.token_store.get_any_token_for_user(user_id)
    if not access_token:
        error_resp = create_error_response(
            error_message="No GitHub account linked. Please connect a repository first.",
            error_code="AUTH_ERROR",
            execution_id=execution_id,
            stage="ASK",
        )
        return error_resp, 403

    is_accessible, repo_info = github_service.oauth_service.validate_repository_access(
        access_token, repo_id
    )

    if not is_accessible:
        error_resp = create_error_response(
            error_message="You do not have pull access to this repository.",
            error_code="AUTH_ERROR",
            execution_id=execution_id,
            stage="ASK",
        )
        return error_resp, 403

    # ------------------------------------------------------------------
    # Invoke the Orchestrator Lambda (Track 5)
    # ------------------------------------------------------------------
    envelope = invoke_orchestrator(
        user_id=user_id,
        repo_id=repo_id,
        user_input=user_input,
    )

    status_code = 202 if envelope.success else 502
    return envelope, status_code


@bp.route('/<id>', methods=['GET'])
@require_auth
@audit_log
@governance_error_handler
def get_execution(id):
    """GET /executions/{id}

    Retrieve the status and details of an execution by querying the DynamoDB ExecutionRecords table.

    REQUIRES: Valid JWT token in Authorization header
    """
    execution_id = generate_execution_id()
    user_id = g.user_id
    
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
            return create_error_response(
                error_message="Execution record not found",
                error_code="NOT_FOUND",
                execution_id=execution_id,
            ), 404
            
        # Optional: ensure the user requesting the record owns it
        if item.get("user_id") != user_id:
            return create_error_response(
                error_message="Unauthorized access to execution record",
                error_code="AUTH_ERROR",
                execution_id=execution_id,
            ), 403
            
        return create_success_response(
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
        ), 200
        
    except ClientError as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"DynamoDB error querying execution {id}: {str(e)}")
        return create_error_response(
            error_message="Database error occurred",
            error_code="INTERNAL_ERROR",
            execution_id=execution_id,
        ), 500
