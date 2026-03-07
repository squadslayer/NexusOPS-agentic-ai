from fastapi import APIRouter, Request, Depends, HTTPException
from typing import Optional, Dict, Any
from bff.middleware import generate_execution_id, require_auth_fastapi
from bff.utils import create_success_response_fastapi, create_error_response_fastapi
from bff.services.auth_service import auth_service
from bff import config
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login(request: Request):
    """
    POST /auth/login
    Authenticate user.
    """
    execution_id = generate_execution_id()
    
    try:
        body = await request.json()
        email = body.get('email')
        
        if not email or '@' not in email:
            return create_error_response_fastapi(
                error_message="Valid email address is required",
                error_code="VALIDATION_ERROR",
                execution_id=execution_id
            )
        
        if config.AUTH_BYPASS:
            mock_user_id = str(uuid.uuid4())
            return create_success_response_fastapi(
                data={
                    'user_id': mock_user_id,
                    'email': email,
                    'token': 'mock-token-local-mode',
                    'auth_bypass': True,
                    'message': 'Authentication bypassed (local mode)',
                    'created': True
                },
                execution_id=execution_id
            )
        
        auth_result = auth_service.login(email=email)
        
        return create_success_response_fastapi(
            data={
                'user_id': auth_result['user_id'],
                'email': auth_result['email'],
                'token': auth_result['token'],
                'created': auth_result['created'],
                'message': 'Authentication successful'
            },
            execution_id=execution_id
        )
    
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return create_error_response_fastapi(
            error_message="Authentication failed",
            error_code="AUTH_ERROR",
            execution_id=execution_id
        )

@router.post("/verify")
async def verify_token(user_id: str = Depends(require_auth_fastapi)):
    """
    POST /auth/verify
    Verify token.
    """
    execution_id = generate_execution_id()
    return create_success_response_fastapi(
        data={
            'user_id': user_id,
            'valid': True,
            'message': 'Token is valid'
        },
        execution_id=execution_id
    )

@router.get("/me")
async def get_current_user(request: Request, user_id: str = Depends(require_auth_fastapi)):
    """
    GET /auth/me
    Returns the current authenticated user's profile from the JWT.
    """
    execution_id = generate_execution_id()
    try:
        # Extract token to get any stored user metadata
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""

        # In AUTH_BYPASS mode, return a mock GitHub profile
        if config.AUTH_BYPASS or token == "mock-token-local-mode":
            return create_success_response_fastapi(
                data={
                    'user_id': user_id or 'local-user',
                    'login': 'nexusops-user',
                    'name': 'NexusOPS User',
                    'email': 'user@nexusops.dev',
                    'avatar_url': 'https://avatars.githubusercontent.com/u/9919?v=4',
                    'html_url': 'https://github.com',
                },
                execution_id=execution_id
            )

        # Try to get real GitHub user info from auth_service
        try:
            user_profile = auth_service.get_user_profile(user_id)
            return create_success_response_fastapi(data=user_profile, execution_id=execution_id)
        except Exception:
            # Fallback: return basic info from token
            return create_success_response_fastapi(
                data={
                    'user_id': user_id,
                    'login': user_id,
                    'name': user_id,
                    'avatar_url': None,
                },
                execution_id=execution_id
            )
    except Exception as e:
        logger.error(f"Get user profile error: {str(e)}")
        return create_error_response_fastapi(
            error_message="Failed to retrieve user profile",
            error_code="PROFILE_ERROR",
            execution_id=execution_id
        )
@router.get("/debug")
async def debug_auth(request: Request, token: Optional[str] = None):
    """
    GET /auth/debug
    Diagnostic endpoint for deep DynamoDB and Token state inspection.
    """
    execution_id = generate_execution_id()
    
    # Resolve token
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        return {"error": "Missing token", "execution_id": execution_id}

    token = token.strip()
    if token.startswith("Bearer "): token = token[7:]

    try:
        from bff.utils.auth_utils import decode_jwt
        from bff.services.github_service import github_service
        from bff.db.dynamodb import get_dynamodb_resource
        
        payload = decode_jwt(token)
        user_id = payload.get("user_id")
        
        # 1. DynamoDB Table Discovery
        dynamodb = get_dynamodb_resource()
        available_tables = []
        try:
            available_tables = [t.name for t in dynamodb.tables.all()]
        except Exception as table_err:
            available_tables = [f"Error listing tables: {str(table_err)}"]

        # 2. Key Check
        token_repo = github_service.token_repo
        primary_table = token_repo.table.table_name
        
        # 3. Query Attempt
        token_obj = token_repo.get_any_token_for_user(user_id)
        
        # 4. Scan Attempt (Limited for debugging)
        scan_results = []
        if not token_obj:
            logger.info(f"Query for {user_id} empty. Running restricted scan on {primary_table}...")
            try:
                response = token_repo.table.scan(Limit=10)
                items = response.get('Items', [])
                for item in items:
                    scan_results.append({
                        'user_id': item.get('user_id'),
                        'repo_id': item.get('repo_id'),
                        'type_user_id': str(type(item.get('user_id')))
                    })
            except Exception as scan_err:
                scan_results = [f"Scan failed: {str(scan_err)}"]

        # 5. Write Test
        write_test = "Not attempted"
        list_test = "Not attempted"
        try:
            from bff.repositories.execution_repository import ExecutionRepository
            from bff.models.execution import ExecutionRecord, ExecutionStatus
            from datetime import datetime
            import time
            
            test_exec_id = f"debug-test-{int(time.time())}"
            test_repo = ExecutionRepository()
            
            # Write Execution
            test_record = ExecutionRecord(
                user_id=user_id,
                execution_id=test_exec_id,
                repo_id="debug-repo",
                status=ExecutionStatus.APPROVAL_PENDING,
                prompt="Debug test write"
            )
            success = test_repo.create_execution(test_record)
            write_test = f"Execution Success (ID: {test_exec_id})" if success else "Execution Failed"
            
            # Write Mock Approval
            try:
                from bff.db.dynamodb import get_table
                approval_table = get_table('ApprovalRecords')
                approval_id = f"appr-{test_exec_id}"
                approval_table.put_item(Item={
                    'approval_id': approval_id,
                    'execution_id': test_exec_id,
                    'status': 'PENDING',
                    'risk_score': 'HIGH',
                    'created_at': int(time.time() * 1000),
                    'user_id': user_id,
                    'plan_summary': "This is a debug mock plan for testing UI decisions."
                })
                write_test += f" | Approval Success (ID: {approval_id})"
            except Exception as appr_err:
                write_test += f" | Approval Failed: {str(appr_err)}"
            
            # Check List
            all_execs = test_repo.get_all_executions(user_id)
            list_test = f"Found {len(all_execs)} executions. IDs: {[e.execution_id for e in all_execs[:3]]}"
            
        except Exception as write_err:
            write_test = f"Error: {str(write_err)}"

        return create_success_response_fastapi(
            data={
                'user_id': user_id,
                'system': {
                    'env': config.ENV,
                    'region': config.AWS_REGION,
                    'auth_bypass': config.AUTH_BYPASS,
                },
                'dynamodb': {
                    'detected_tables': available_tables,
                    'config_execution_table': config.DYNAMODB_TABLE_EXECUTION_RECORDS,
                    'write_test_result': write_test,
                    'list_test_result': list_test,
                    'queried_table': primary_table,
                    'has_token': token_obj is not None,
                    'token_repo_id': token_obj.repo_id if token_obj else None,
                    'debug_scan_sample': scan_results[:5] 
                },
                'token_payload': {k: v for k, v in payload.items() if k not in ['exp', 'iat']}
            },
            execution_id=execution_id
        )
    except Exception as e:
        logger.error(f"Debug critical failure: {str(e)}", exc_info=True)
        return {"error": str(e), "execution_id": execution_id}

from fastapi.responses import RedirectResponse
from bff.services.github_service import github_service
import jwt as pyjwt
import time

@router.get("/github")
async def github_login():
    """
    GET /auth/github
    Redirects the user to GitHub's OAuth authorization page.
    """
    auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={config.GITHUB_CLIENT_ID}"
        f"&redirect_uri={config.GITHUB_REDIRECT_URI}"
        f"&scope=read:user,user:email,repo"
    )
    return RedirectResponse(url=auth_url)


@router.get("/github/callback")
async def github_callback(code: str = None, error: str = None):
    """
    GET /auth/github/callback
    Handles the GitHub OAuth callback, exchanges code for token,
    fetches user profile, issues a JWT, and redirects to the dashboard.
    """
    dashboard_url = f"{config.FRONTEND_URL}/dashboard"

    if error or not code:
        logger.error(f"GitHub OAuth error callback: error={error}, code={code}")
        return RedirectResponse(url=f"{config.FRONTEND_URL}/login?error=github_denied")

    try:
        # Step 1: Exchange code for GitHub access token
        try:
            token_result = github_service.oauth_service.exchange_code_for_token(code)
            access_token = token_result.get("access_token") if isinstance(token_result, dict) else token_result
            if not access_token:
                raise ValueError("No access_token in OAuth response")
        except Exception as e:
            logger.error(f"Step 1 (Token Exchange) failed: {e}")
            return RedirectResponse(url=f"{config.FRONTEND_URL}/login?error=token_failed")
        
        # Step 2: Fetch GitHub user profile
        try:
            logger.info(f"Fetching GitHub profile for token starting with {access_token[:5]}...")
            gh_user = github_service.oauth_service.get_user_profile(access_token)
        except Exception as e:
            logger.error(f"Step 2 (Profile Fetch) failed: {e}")
            return RedirectResponse(url=f"{config.FRONTEND_URL}/login?error=profile_failed")

        user_id = str(gh_user.get("id", "unknown"))
        login = gh_user.get("login", "user")
        name = gh_user.get("name") or login
        avatar_url = gh_user.get("avatar_url", "")
        email = gh_user.get("email", f"{login}@github.com")

        # Step 3: Issue a NexusOPS JWT
        try:
            payload = {
                "sub": user_id,
                "user_id": user_id,
                "login": login,
                "name": name,
                "email": email,
                "avatar_url": avatar_url,
                "iss": "nexusops-bff",
                "iat": int(time.time()),
                "exp": int(time.time()) + (config.JWT_EXPIRATION_HOURS * 3600),
            }
            token = pyjwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)
        except Exception as e:
            logger.error(f"Step 3 (JWT Issuance) failed: {e}")
            return RedirectResponse(url=f"{config.FRONTEND_URL}/login?error=jwt_failed")

        # Step 4: Store the GitHub access token in memory/DB
        try:
            github_service.store_session_token(user_id, access_token)
        except Exception as e:
            logger.error(f"Step 4 (Token Storage) failed: {e}")
            return RedirectResponse(url=f"{config.FRONTEND_URL}/login?error=db_failed")

        # Step 5: Redirect to dashboard with token
        return RedirectResponse(url=f"{dashboard_url}?token={token}")

    except Exception as e:
        logger.error(f"GitHub OAuth global failure: {e}")
        return RedirectResponse(url=f"{config.FRONTEND_URL}/login?error=unknown_error")
