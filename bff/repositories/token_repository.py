from datetime import datetime
from bff.db.dynamodb import get_table
from bff.models.github_token import GithubToken
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)

class TokenRepository:
    def __init__(self):
        self.table = get_table('GitHubTokens')

    def store_token(self, token_data: GithubToken):
        """Stores or updates a GitHub OAuth token."""
        try:
            item = token_data.model_dump()
            # Convert datetime to ISO format for DynamoDB
            item['created_at'] = item['created_at'].isoformat()
            item['updated_at'] = item['updated_at'].isoformat()
            
            self.table.put_item(Item=item)
            logger.info(f"Stored token for user {token_data.user_id}, repo {token_data.repo_id}")
            return True
        except Exception as e:
            logger.error(f"Error storing token: {e}")
            return False

    def get_token(self, user_id: str, repo_id: str):
        """Retrieves a specific token for a user and repository."""
        try:
            response = self.table.get_item(Key={'user_id': user_id, 'repo_id': repo_id})
            item = response.get('Item')
            if item:
                # Convert ISO string back to datetime (simplistic approach for now)
                item['created_at'] = datetime.fromisoformat(item['created_at'])
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
                return GithubToken(**item)
            return None
        except Exception as e:
            logger.error(f"Error retrieving token: {e}")
            return None

    def get_any_token_for_user(self, user_id: str):
        """Retrieves any available token for a user (useful for general API calls)."""
        try:
            response = self.table.query(
                KeyConditionExpression="user_id = :uid",
                ExpressionAttributeValues={":uid": user_id},
                Limit=1
            )
            items = response.get('Items', [])
            if items:
                item = items[0]
                item['created_at'] = datetime.fromisoformat(item['created_at'])
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
                return GithubToken(**item)
            return None
        except Exception as e:
            logger.error(f"Error querying user tokens: {e}")
            return None
