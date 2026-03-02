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

from flask import Blueprint, request, g
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
    # Verify the repo belongs to the authenticated user (Track 4)
    # ------------------------------------------------------------------
    user_id = g.user_id

    stored_token = github_service.token_store.get_token(user_id, repo_id)
    if stored_token is None:
        error_resp = create_error_response(
            error_message="Repository not linked to your account",
            error_code="AUTH_ERROR",
            execution_id=execution_id,
            stage="ASK",
        )
        return format_response_for_api(error_resp, 403)

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

    Retrieve the status and details of an execution by ID.

    REQUIRES: Valid JWT token in Authorization header
    Format: Authorization: Bearer {token}

    User context injected by @require_auth decorator:
    - g.user_id: Authenticated user's UUID
    - g.user_email: Authenticated user's email

    Args:
        id (str): The execution ID

    Returns:
        StandardResponseEnvelope: Execution status and details
    """
    execution_id = generate_execution_id()
    response = create_success_response(
        data={
            'execution_id': id,
            'status': 'completed',
            'message': 'Execution details retrieved successfully',
            'stage': 'ASK',
            'requested_by': g.user_id
        },
        execution_id=execution_id
    )
    return response, 200
