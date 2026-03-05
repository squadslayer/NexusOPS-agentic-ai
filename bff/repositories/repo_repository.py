from datetime import datetime
from bff.db.dynamodb import get_table
from bff.models.repository import Repository
import logging

logger = logging.getLogger(__name__)

class RepoRepository:
    def __init__(self):
        self.table = get_table('Repositories')

    def store_repository(self, repo_data: Repository):
        """Stores or updates a repository connection record."""
        try:
            item = repo_data.model_dump()
            item['connected_at'] = item['connected_at'].isoformat()
            if item.get('last_sync_at'):
                item['last_sync_at'] = item['last_sync_at'].isoformat()
            
            self.table.put_item(Item=item)
            logger.info(f"Stored repository {repo_data.repo_id} for user {repo_data.user_id}")
            return True
        except Exception as e:
            logger.error(f"Error storing repository: {e}")
            return False

    def get_user_repositories(self, user_id: str):
        """Retrieves all connected repositories for a user."""
        try:
            response = self.table.query(
                KeyConditionExpression="user_id = :uid",
                ExpressionAttributeValues={":uid": user_id}
            )
            items = response.get('Items', [])
            repos = []
            for item in items:
                item['connected_at'] = datetime.fromisoformat(item['connected_at'])
                if item.get('last_sync_at'):
                    item['last_sync_at'] = datetime.fromisoformat(item['last_sync_at'])
                repos.append(Repository(**item))
            return repos
        except Exception as e:
            logger.error(f"Error retrieving user repositories: {e}")
            return []
