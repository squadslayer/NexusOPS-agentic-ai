from fastapi import APIRouter, Request, Depends, HTTPException
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
    dashboard_url = "http://localhost:3000/dashboard"

    if error or not code:
        return RedirectResponse(url=f"http://localhost:3000/login?error=github_denied")

    try:
        # Exchange code for GitHub access token
        token_result = github_service.oauth_service.exchange_code_for_token(code)
        access_token = token_result.get("access_token") if isinstance(token_result, dict) else token_result
        if not access_token:
            raise ValueError("No access_token in OAuth response")
    except Exception as e:
        logger.error(f"GitHub OAuth exchange failed: {e}")
        return RedirectResponse(url=f"http://localhost:3000/login?error=oauth_failed")

    try:
        # Fetch GitHub user profile
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
            )
            gh_user = r.json()

        user_id = str(gh_user.get("id", "unknown"))
        login = gh_user.get("login", "user")
        name = gh_user.get("name") or login
        avatar_url = gh_user.get("avatar_url", "")
        email = gh_user.get("email", f"{login}@github.com")

        # Issue a NexusOPS JWT (include both 'sub' and 'user_id' for compatibility)
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

        # Store the GitHub access token in memory so /repos/ can use it
        github_service.store_session_token(user_id, access_token)

        # Redirect to dashboard with token in query param (frontend picks it up and saves to localStorage)
        return RedirectResponse(url=f"{dashboard_url}?token={token}")

    except Exception as e:
        logger.error(f"GitHub profile fetch failed: {e}")
        return RedirectResponse(url=f"http://localhost:3000/login?error=profile_failed")
