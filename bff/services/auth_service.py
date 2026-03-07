"""Authentication and token management service.

Handles user registration, login, and token generation with DynamoDB integration.
"""

import logging
import uuid
import boto3
from typing import Dict, Optional, Any
from bff import config
from bff.utils.auth_utils import encode_jwt

logger = logging.getLogger(__name__)


class DynamoDBUserStore:
    """Service for managing user records in DynamoDB."""
    
    def __init__(self):
        """Initialize DynamoDB client."""
        from bff.db.dynamodb import get_dynamodb_resource
        self.dynamodb = get_dynamodb_resource()
        self.table_name = config.DYNAMODB_TABLE_USERS
        self.table = self.dynamodb.Table(self.table_name)
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a user record from DynamoDB by user_id (Primary Key).
        
        STRICT GOVERNANCE: Uses get_item only (no scans allowed).
        
        Args:
            user_id (str): UUID of the user to retrieve
            
        Returns:
            Optional[Dict]: User record if found, None otherwise
            
        Raises:
            Exception: If DynamoDB operation fails
        """
        try:
            response = self.table.get_item(Key={'user_id': user_id})
            user = response.get('Item')
            
            if user:
                logger.debug(f"User retrieved from DynamoDB: {user_id}")
            else:
                logger.debug(f"User not found in DynamoDB: {user_id}")
            
            return user
        except Exception as e:
            logger.error(f"Error retrieving user {user_id} from DynamoDB: {str(e)}")
            raise
    
    def create_user(self, email: str, user_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Create a new user record in DynamoDB.
        
        STRICT GOVERNANCE:
        - Uses put_item only (no scans allowed)
        - Generates UUID as Primary Key
        - Stores creation timestamp
        
        Args:
            email (str): User email address
            user_metadata (Optional[Dict]): Additional user metadata
            
        Returns:
            Dict: Created user record with user_id
            
        Raises:
            Exception: If DynamoDB operation fails
            
        Example:
            user = auth_service.create_user(
                email="user@example.com",
                user_metadata={"github_username": "johndoe"}
            )
        """
        try:
            # Generate UUID as Primary Key
            user_id = str(uuid.uuid4())
            
            # Get current timestamp
            timestamp = __import__('datetime').datetime.utcnow().isoformat()
            
            # Build user record
            user_record = {
                'user_id': user_id,
                'email': email,
                'created_at': timestamp,
                'updated_at': timestamp
            }
            
            # Add metadata if provided
            if user_metadata:
                user_record['metadata'] = user_metadata
            
            # Store in DynamoDB using put_item
            self.table.put_item(Item=user_record)
            
            logger.info(f"User created in DynamoDB: {user_id} ({email})")
            return user_record
        
        except Exception as e:
            logger.error(f"Error creating user in DynamoDB: {str(e)}")
            raise
    
    def update_user_metadata(self, user_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update user metadata in DynamoDB.
        
        Args:
            user_id (str): UUID of the user
            metadata (Dict): Metadata to update
            
        Returns:
            Dict: Updated user record
            
        Raises:
            Exception: If DynamoDB operation fails
        """
        try:
            # Get current user first
            user = self.get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User not found: {user_id}")
            
            # Update metadata
            timestamp = __import__('datetime').datetime.utcnow().isoformat()
            user['metadata'] = metadata
            user['updated_at'] = timestamp
            
            # Update in DynamoDB using put_item
            self.table.put_item(Item=user)
            
            logger.info(f"User metadata updated: {user_id}")
            return user
        
        except Exception as e:
            logger.error(f"Error updating user metadata: {str(e)}")
            raise


class AuthService:
    """High-level authentication service."""
    
    def __init__(self):
        """Initialize authentication service."""
        self.user_store = DynamoDBUserStore()
    
    def login(self, email: str, user_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Authenticate user or create new account on first login.
        
        LOGIN FLOW:
        1. Check if user exists by email lookup (NOT ALLOWED - use get_item only)
        2. If user doesn't exist:
           - Return None or create new user record with UUID PK
        3. If user exists:
           - Generate JWT token
           - Return user_id and token
        
        NOTE: Since we cannot scan by email, we'll use a simplified flow:
        - Generate UUID for new users
        - Return user_id and token
        - Caller must manage user_id → email mapping
        
        Args:
            email (str): User email address
            user_metadata (Optional[Dict]): Additional metadata
            
        Returns:
            Dict: {
                "user_id": "uuid",
                "email": "user@example.com",
                "token": "jwt_token",
                "created": boolean (True if new user)
            }
            
        Raises:
            Exception: If authentication fails
        """
        try:
            # For new login, create user record (simplified approach)
            # In production, you'd maintain an email→user_id index
            user_record = self.user_store.create_user(
                email=email,
                user_metadata=user_metadata
            )
            
            user_id = user_record['user_id']
            
            # Generate JWT token
            token = encode_jwt(user_id=user_id, email=email)
            
            logger.info(f"User authenticated: {user_id} ({email})")
            
            return {
                "user_id": user_id,
                "email": email,
                "token": token,
                "created": True
            }
        
        except Exception as e:
            logger.error(f"Login failed for {email}: {str(e)}")
            raise
    
    def login_existing_user(self, user_id: str, email: str) -> Dict[str, Any]:
        """
        Generate new token for existing user.
        
        Args:
            user_id (str): User's UUID
            email (str): User's email
            
        Returns:
            Dict: {
                "user_id": "uuid",
                "email": "user@example.com",
                "token": "jwt_token",
                "created": False
            }
            
        Raises:
            Exception: If token generation fails
        """
        try:
            # Verify user exists
            user = self.user_store.get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User not found: {user_id}")
            
            # Generate JWT token
            token = encode_jwt(user_id=user_id, email=email)
            
            logger.info(f"Token generated for existing user: {user_id}")
            
            return {
                "user_id": user_id,
                "email": email,
                "token": token,
                "created": False
            }
        
        except Exception as e:
            logger.error(f"Token generation failed for {user_id}: {str(e)}")
    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Fetch full user profile, including GitHub metadata.
        
        Args:
            user_id (str): UUID of the user
            
        Returns:
            Dict: User profile data
        """
        try:
            # 1. Get user record from DynamoDB
            user = self.user_store.get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User not found: {user_id}")
            
            # 2. Get GitHub token for the user
            from bff.services.github_service import github_service
            token_obj = github_service.token_repo.get_any_token_for_user(user_id)
            
            # 3. If token exists, fetch current GitHub profile
            gh_profile = {}
            if token_obj:
                try:
                    access_token = github_service.token_store.encryption_service.decrypt_token(token_obj.access_token_encrypted)
                    gh_profile = github_service.oauth_service.get_user_profile(access_token)
                except Exception as gh_err:
                    logger.warning(f"Failed to fetch GitHub profile for {user_id}: {gh_err}")
            
            # 4. Merge data
            return {
                "user_id": user_id,
                "email": user.get("email"),
                "login": gh_profile.get("login", user.get("metadata", {}).get("github_username", user_id)),
                "name": gh_profile.get("name") or user.get("metadata", {}).get("name", "NexusOps User"),
                "avatar_url": gh_profile.get("avatar_url"),
                "html_url": gh_profile.get("html_url"),
                "created_at": user.get("created_at")
            }
        except Exception as e:
            logger.error(f"Error getting user profile for {user_id}: {str(e)}")
            raise


# Create singleton instance
auth_service = AuthService()
