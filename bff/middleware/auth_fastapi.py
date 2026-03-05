from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bff.utils.auth_utils import decode_jwt
from bff import config
import logging
import jwt

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

async def require_auth_fastapi(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    FastAPI dependency for authentication.
    """
    if config.AUTH_BYPASS:
        return "local-dev-user"

    if not credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = credentials.credentials
    try:
        payload = decode_jwt(token)
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user_id")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
