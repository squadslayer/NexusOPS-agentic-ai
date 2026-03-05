"""GitHub API integration service.

Handles OAuth token exchange, token encryption/decryption, and repository validation.
"""

import logging
import requests
import boto3
import base64
from typing import Dict, Optional, Any, Tuple
from datetime import datetime
from bff import config
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class TokenEncryptionService:
    """Service for encrypting and decrypting GitHub access tokens."""
    
    def __init__(self):
        """Initialize encryption service with key from config."""
        # Ensure the key is 32 bytes (Base64 encoded)
        key = config.ENCRYPTION_KEY
        if len(key) < 32:
            key = base64.urlsafe_b64encode((key * 4).encode())[:44].decode()
        else:
            key = key[:32]
            key = base64.urlsafe_b64encode(key.encode()).decode()
        
        self.cipher = Fernet(key.encode() if isinstance(key, str) else key)
    
    def encrypt_token(self, token: str) -> str:
        """
        Encrypt a GitHub access token.
        
        Args:
            token (str): Plain text access token
            
        Returns:
            str: Encrypted token (Base64 encoded)
            
        Raises:
            Exception: If encryption fails
        """
        try:
            encrypted = self.cipher.encrypt(token.encode())
            return base64.b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Token encryption failed: {str(e)}")
            raise
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """
        Decrypt a GitHub access token.
        
        Args:
            encrypted_token (str): Encrypted token (Base64 encoded)
            
        Returns:
            str: Plain text access token
            
        Raises:
            Exception: If decryption fails
        """
        try:
            decoded = base64.b64decode(encrypted_token.encode())
            decrypted = self.cipher.decrypt(decoded)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Token decryption failed: {str(e)}")
            raise


class GitHubOAuthService:
    """Service for GitHub OAuth token exchange."""
    
    def __init__(self):
        """Initialize OAuth service."""
        self.client_id = config.GITHUB_CLIENT_ID
        self.client_secret = config.GITHUB_CLIENT_SECRET
        self.redirect_uri = config.GITHUB_REDIRECT_URI
        self.token_url = "https://github.com/login/oauth/access_token"
        self.api_base = config.GITHUB_API_BASE_URL
    def get_authorization_url(self, state: str) -> str:
        """Generate GitHub OAuth authorization URL."""
        return (
            f"https://github.com/login/oauth/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope=repo,read:user"
            f"&state={state}"
        )
    def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange GitHub authorization code for access token.
        
        OAUTH FLOW:
        1. User authorizes NexusOps on GitHub
        2. GitHub redirects with temporary `code`
        3. We exchange `code` for permanent `access_token`
        4. Use token for API calls
        
        Args:
            code (str): Temporary authorization code from GitHub
            
        Returns:
            Dict: {
                "access_token": "token",
                "token_type": "bearer",
                "scope": "repo:status,public_repo"
            }
            
        Raises:
            Exception: If token exchange fails
        """
        try:
            payload = {
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'code': code,
                'redirect_uri': self.redirect_uri
            }
            
            headers = {'Accept': 'application/json'}
            
            response = requests.post(self.token_url, json=payload, headers=headers, timeout=10)
            
            if response.status_code != 200:
                logger.error(f"GitHub OAuth token exchange failed: {response.text}")
                raise ValueError(f"OAuth exchange failed: {response.status_code}")
            
            result = response.json()
            
            if 'error' in result:
                logger.error(f"GitHub OAuth error: {result.get('error_description')}")
                raise ValueError(f"OAuth error: {result.get('error')}")
            
            logger.info(f"GitHub OAuth token exchange successful")
            return result
        
        except requests.RequestException as e:
            logger.error(f"Network error during token exchange: {str(e)}")
            raise
    
    def validate_repository_access(self, access_token: str, repo_url: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Verify that the user has access to the specified GitHub repository.
        
        Args:
            access_token (str): GitHub access token
            repo_url (str): Repository URL (e.g., "https://github.com/owner/repo")
            
        Returns:
            Tuple: (is_accessible, repo_info)
            
        Raises:
            Exception: If validation fails
        """
        try:
            # Parse repo URL
            parts = repo_url.rstrip('/').split('/')
            owner = parts[-2]
            repo = parts[-1]
            
            # Get repository info
            repo_endpoint = f"{self.api_base}/repos/{owner}/{repo}"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(repo_endpoint, headers=headers, timeout=10)
            
            if response.status_code == 200:
                repo_info = response.json()
                permissions = repo_info.get("permissions", {})
                
                # Verify pull (read) access at minimum
                if not permissions.get("pull", False):
                    logger.warning(f"User lacks pull permission to {owner}/{repo}")
                    return False, repo_info
                    
                logger.info(f"Repository access verified (pull access): {owner}/{repo}")
                return True, repo_info
            elif response.status_code == 404:
                logger.warning(f"Repository not found: {owner}/{repo}")
                return False, {}
            elif response.status_code == 401:
                logger.warning(f"Unauthorized access to {owner}/{repo}")
                return False, {}
            else:
                logger.warning(f"Failed to verify repository: {response.status_code}")
                return False, {}
        
        except Exception as e:
            logger.error(f"Repository validation error: {str(e)}")
            raise
    
    def get_token_scopes(self, access_token: str) -> list:
        """
        Get the list of scopes assigned to the access token.
        
        Args:
            access_token (str): GitHub access token
            
        Returns:
            list: List of scopes (e.g., ["repo", "read:user"])
            
        Raises:
            Exception: If scope retrieval fails
        """
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(f"{self.api_base}/user", headers=headers, timeout=10)
            
            if response.status_code == 200:
                # Scopes are in the X-OAuth-Scopes header
                scopes_header = response.headers.get('X-OAuth-Scopes', '')
                scopes = [s.strip() for s in scopes_header.split(',')] if scopes_header else []
                logger.debug(f"Token scopes: {scopes}")
                return scopes
            else:
                logger.warning(f"Failed to get token scopes: {response.status_code}")
                return []
        
        except Exception as e:
            logger.error(f"Error retrieving token scopes: {str(e)}")
            raise
            
    def get_user_repos(self, access_token: str) -> list:
        """
        Get all repositories accessible to the user (owned, member, collaborator).
        """
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            # affiliation parameter is critical for including organization and collaborator repos
            url = f"{self.api_base}/user/repos?affiliation=owner,collaborator,organization_member&per_page=100"
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to fetch user repos: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error fetching user repos: {str(e)}")
            raise


class GitHubTokenStore:
    """Service for storing and retrieving GitHub tokens from DynamoDB."""
    
    def __init__(self):
        """Initialize DynamoDB client."""
        self.dynamodb = boto3.resource(
            'dynamodb',
            region_name=config.AWS_REGION,
            endpoint_url=config.DYNAMODB_ENDPOINT if config.DYNAMODB_ENDPOINT else None
        )
        self.table_name = 'GitHubTokens'
        self.table = self.dynamodb.Table(self.table_name)
        self.encryption_service = TokenEncryptionService()
    
    def store_token(
        self,
        user_id: str,
        access_token: str,
        repo_url: str,
        repo_scope: str = "repo"
    ) -> Dict[str, Any]:
        """
        Store GitHub access token in GitHubTokens table.
        
        STORAGE RULES:
        - Token is encrypted before storage
        - Primary Key: user_id + repo_url (composite)
        - Store: user_id, encrypted_token, repo_url, repo_scope, created_at
        - No scans allowed (IAM compliant)
        
        Args:
            user_id (str): NexusOps user ID
            access_token (str): Plain GitHub access token
            repo_url (str): Repository URL
            repo_scope (str): Required scope (default: "repo")
            
        Returns:
            Dict: Stored record
            
        Raises:
            Exception: If storage fails
        """
        try:
            # Encrypt token before storage
            encrypted_token = self.encryption_service.encrypt_token(access_token)
            
            # Get current timestamp
            timestamp = datetime.utcnow().isoformat()
            
            # Build record
            record = {
                'user_id': user_id,
                'repo_url': repo_url,
                'encrypted_token': encrypted_token,
                'repo_scope': repo_scope,
                'created_at': timestamp,
                'updated_at': timestamp
            }
            
            # Store in DynamoDB using put_item
            self.table.put_item(Item=record)
            
            logger.info(f"GitHub token stored for user {user_id}: {repo_url}")
            return record
        
        except Exception as e:
            logger.error(f"Error storing GitHub token: {str(e)}")
            raise
    
    def get_token(self, user_id: str, repo_url: str) -> Optional[str]:
        """
        Retrieve and decrypt GitHub access token from table.
        
        STRICT GOVERNANCE: Uses get_item only (no scans).
        
        Args:
            user_id (str): NexusOps user ID
            repo_url (str): Repository URL
            
        Returns:
            Optional[str]: Decrypted access token, or None if not found
            
        Raises:
            Exception: If retrieval/decryption fails
        """
        try:
            response = self.table.get_item(
                Key={'user_id': user_id, 'repo_url': repo_url}
            )
            
            item = response.get('Item')
            if not item:
                logger.debug(f"No token found for user {user_id}: {repo_url}")
                return None
            
            # Decrypt token
            encrypted_token = item.get('encrypted_token')
            if not encrypted_token:
                logger.warning(f"Token field missing for user {user_id}: {repo_url}")
                return None
            
            decrypted_token = self.encryption_service.decrypt_token(encrypted_token)
            logger.debug(f"GitHub token retrieved for user {user_id}: {repo_url}")
            return decrypted_token
        
        except Exception as e:
            logger.error(f"Error retrieving GitHub token: {str(e)}")
            raise
            
    def get_any_token_for_user(self, user_id: str) -> Optional[str]:
        """
        Retrieve ANY active token for the user to make user-level profile API calls.
        Uses a DynamoDB Query on the partition key.
        """
        try:
            from boto3.dynamodb.conditions import Key
            response = self.table.query(
                KeyConditionExpression=Key('user_id').eq(user_id),
                Limit=1
            )
            
            items = response.get('Items', [])
            if not items:
                logger.debug(f"No tokens found for user {user_id}")
                return None
                
            encrypted_token = items[0].get('encrypted_token')
            if not encrypted_token:
                return None
                
            return self.encryption_service.decrypt_token(encrypted_token)
            
        except Exception as e:
            logger.error(f"Error querying ANY token for user {user_id}: {str(e)}")
            raise
    
    def check_repo_linked_to_other_user(self, repo_url: str, current_user_id: str) -> bool:
        """
        Check if repository is already linked to another user.
        
        NOTE: This check assumes we have an index on repo_url.
        In production, use a GSI (Global Secondary Index) on repo_url.
        
        For now, this returns False as we cannot scan without breaking governance.
        Consider implementing a separate RepoIndex table.
        
        Args:
            repo_url (str): Repository URL
            current_user_id (str): Current user's ID
            
        Returns:
            bool: True if linked to another user, False otherwise
        """
        logger.debug(f"Duplicate check for {repo_url} by user {current_user_id}")
        # Without GSI, we cannot check duplicates efficiently
        # This should be implemented with a GSI in production
        return False


class GitHubIntegrationService:
    """High-level GitHub integration service."""
    
    def __init__(self):
        """Initialize all GitHub services."""
        self.oauth_service = GitHubOAuthService()
        self.token_store = GitHubTokenStore()
    
    def connect_repository(
        self,
        user_id: str,
        code: str,
        repo_url: str
    ) -> Dict[str, Any]:
        """
        Complete flow to connect a GitHub repository.
        
        INTEGRATION FLOW:
        1. Exchange code for access_token
        2. Validate repo access
        3. Check token scopes
        4. Check for duplicate linking
        5. Store encrypted token
        6. Return connection info
        
        Args:
            user_id (str): Authenticated user ID
            code (str): GitHub OAuth code
            repo_url (str): Target repository URL
            
        Returns:
            Dict: {
                "user_id": "uuid",
                "repo_url": "https://github.com/owner/repo",
                "connected": true,
                "scopes": ["repo", "read:user"],
                "repo_info": {...}
            }
            
        Raises:
            Exception: If any step fails
        """
        try:
            # Step 1: Exchange code for token
            logger.info(f"Starting GitHub OAuth flow for user {user_id}")
            token_result = self.oauth_service.exchange_code_for_token(code)
            access_token = token_result.get('access_token')
            
            if not access_token:
                raise ValueError("No access token in OAuth response")
            
            # Step 2: Validate repo access
            is_accessible, repo_info = self.oauth_service.validate_repository_access(
                access_token, repo_url
            )
            
            if not is_accessible:
                raise ValueError(f"User does not have access to repository: {repo_url}")
            
            # Step 3: Get token scopes
            scopes = self.oauth_service.get_token_scopes(access_token)
            required_scopes = {'repo', 'read:user'}
            
            if not required_scopes.issubset(set(scopes)):
                raise ValueError(f"Token missing required scopes. Required: {required_scopes}, Got: {scopes}")
            
            # Step 4: Check for duplicate
            is_duplicate = self.token_store.check_repo_linked_to_other_user(repo_url, user_id)
            if is_duplicate:
                raise ValueError(f"Repository already linked to another user")
            
            # Step 5: Store encrypted token
            self.token_store.store_token(
                user_id=user_id,
                access_token=access_token,
                repo_url=repo_url,
                repo_scope=",".join(scopes)
            )
            
            logger.info(f"Repository connected successfully: {repo_url}")
            
            return {
                "user_id": user_id,
                "repo_url": repo_url,
                "connected": True,
                "repo_name": repo_info.get('name', ''),
                "repo_owner": repo_info.get('owner', {}).get('login', ''),
                "scopes": scopes
            }
        
        except Exception as e:
            logger.error(f"GitHub integration failed: {str(e)}")
            raise

    def get_user_repos(self, user_id: str) -> list:
        """
        Fetch all repositories accessible to the authenticated user.

        Uses the stored GitHub access token for the user. If no token
        is found (e.g. local dev with AUTH_BYPASS), returns an empty list.

        Args:
            user_id (str): NexusOps user ID

        Returns:
            list: List of repository dicts from the GitHub API
        """
        try:
            # Try to get any stored token for this user
            # In local dev (AUTH_BYPASS) the user_id will be "local-dev-user"
            # and there won't be a stored token — return empty list gracefully.
            access_token = None

            # Check if user has a stored token for any repo
            # (We can't scan DynamoDB, so we try using the token from the session)
            if hasattr(self, '_session_tokens') and user_id in self._session_tokens:
                access_token = self._session_tokens[user_id]

            if not access_token:
                logger.info(f"No GitHub token found for user {user_id} — returning empty repo list")
                return []

            # Call GitHub API to list user repos
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            }

            response = requests.get(
                f"{self.oauth_service.api_base}/user/repos",
                headers=headers,
                params={"per_page": 100, "sort": "updated"},
                timeout=15
            )

            if response.status_code == 200:
                repos = response.json()
                logger.info(f"Fetched {len(repos)} repos for user {user_id}")
                return repos
            else:
                logger.warning(f"GitHub API returned {response.status_code} for user repos")
                return []

        except Exception as e:
            logger.error(f"Error fetching repos for user {user_id}: {str(e)}")
            return []

    def store_session_token(self, user_id: str, access_token: str):
        """Store a GitHub access token in memory for the current session."""
        if not hasattr(self, '_session_tokens'):
            self._session_tokens = {}
        self._session_tokens[user_id] = access_token
        logger.debug(f"Session token stored for user {user_id}")


# Create singleton instance
github_service = GitHubIntegrationService()
token_store = GitHubTokenStore()
