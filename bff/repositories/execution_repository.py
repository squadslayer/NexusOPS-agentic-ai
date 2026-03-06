from datetime import datetime
from bff.db.dynamodb import get_table
from bff.models.execution import ExecutionRecord, ExecutionStatus
import logging

logger = logging.getLogger(__name__)

class ExecutionRepository:
    def __init__(self):
        self.table = get_table('ExecutionRecords')

    def create_execution(self, execution_data: ExecutionRecord):
        """Initializes a new execution record."""
        try:
            item = execution_data.model_dump()
            item['created_at'] = item['created_at'].isoformat()
            item['updated_at'] = item['updated_at'].isoformat()
            
            self.table.put_item(Item=item)
            logger.info(f"Created execution {execution_data.execution_id} for user {execution_data.user_id}")
            return True
        except Exception as e:
            logger.error(f"Error creating execution: {e}")
            return False

    def update_execution_status(self, user_id: str, execution_id: str, status: ExecutionStatus, result: dict = None):
        """Updates the status and results of an execution with optimistic locking."""
        from botocore.exceptions import ClientError
        from fastapi import HTTPException
        
        try:
            # 1. Fetch current version
            execution = self.get_execution(user_id, execution_id)
            if not execution:
                return False
            
            current_version = execution.version

            # 2. Update with version check
            update_expression = "SET #stat = :s, updated_at = :u, version = :nv"
            expression_values = {
                ":s": status.value,
                ":u": datetime.utcnow().isoformat(),
                ":cv": current_version,
                ":nv": current_version + 1
            }
            expression_names = {"#stat": "status"}

            if result is not None:
                update_expression += ", #res = :r"
                expression_values[":r"] = result
                expression_names["#res"] = "result"
            
            self.table.update_item(
                Key={'user_id': user_id, 'execution_id': execution_id},
                UpdateExpression=update_expression,
                ConditionExpression="version = :cv",
                ExpressionAttributeValues=expression_values,
                ExpressionAttributeNames=expression_names
            )
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                logger.warning(f"Optimistic lock failure for execution {execution_id}")
                raise HTTPException(status_code=409, detail="Execution was modified by another request")
            logger.error(f"DynamoDB error updating execution: {e}")
            return False
        except Exception as e:
            logger.error(f"Error updating execution: {e}")
            return False

    def get_execution(self, user_id: str, execution_id: str):
        """Retrieves an execution record by user ID and execution ID."""
        try:
            response = self.table.get_item(
                Key={'user_id': user_id, 'execution_id': execution_id}
            )
            item = response.get('Item')
            if item:
                item['created_at'] = datetime.fromisoformat(item['created_at'])
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
                return ExecutionRecord(**item)
            return None
        except Exception as e:
            logger.error(f"Error retrieving execution: {e}")
            return None

    def get_executions_by_repo(self, user_id: str, repo_id: str):
        """Retrieves all execution records for a specific repository."""
        try:
            response = self.table.query(
                IndexName="UserRepoIndex",
                KeyConditionExpression="user_id = :uid AND repo_id = :rid",
                ExpressionAttributeValues={":uid": user_id, ":rid": repo_id}
            )
            items = response.get('Items', [])
            result = []
            for item in items:
                item['created_at'] = datetime.fromisoformat(item['created_at'])
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
                result.append(ExecutionRecord(**item))
            return result
        except Exception as e:
            logger.error(f"Error retrieving executions by repo: {e}")
            return []

    def get_executions_by_status(self, user_id: str, status: ExecutionStatus):
        """Retrieves all execution records for a specific status."""
        try:
            response = self.table.query(
                IndexName="UserStatusIndex",
                KeyConditionExpression="user_id = :uid AND #stat = :s",
                ExpressionAttributeValues={":uid": user_id, ":s": status.value},
                ExpressionAttributeNames={"#stat": "status"}
            )
            items = response.get('Items', [])
            result = []
            for item in items:
                item['created_at'] = datetime.fromisoformat(item['created_at'])
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
                result.append(ExecutionRecord(**item))
            return result
        except Exception as e:
            logger.error(f"Error retrieving executions by status: {e}")
            return []

    def get_all_executions(self, user_id: str):
        """Retrieves all execution records for a specific user."""
        try:
            response = self.table.query(
                KeyConditionExpression="user_id = :uid",
                ExpressionAttributeValues={":uid": user_id}
            )
            items = response.get('Items', [])
            result = []
            for item in items:
                item['created_at'] = datetime.fromisoformat(item['created_at'])
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
                result.append(ExecutionRecord(**item))
            # Sort by created_at descending (newest first)
            result.sort(key=lambda x: x.created_at, reverse=True)
            return result
        except Exception as e:
            logger.error(f"Error retrieving all executions: {e}")
            return []

    def get_approval_by_execution(self, execution_id: str):
        """Retrieves an approval record for a specific execution using the ExecutionIdIndex."""
        from bff.db.dynamodb import get_table
        approval_table = get_table('ApprovalRecords')
        try:
            response = approval_table.query(
                IndexName="ExecutionIdIndex",
                KeyConditionExpression="execution_id = :eid",
                ExpressionAttributeValues={":eid": execution_id}
            )
            items = response.get('Items', [])
            return items[0] if items else None
        except Exception as e:
            logger.error(f"Error querying approval record: {e}")
            return None

    def update_approval_status(self, approval_id: str, status: str):
        """Updates the status of an approval record from PENDING."""
        from bff.db.dynamodb import get_table
        import time
        approval_table = get_table('ApprovalRecords')
        try:
            response = approval_table.update_item(
                Key={'approval_id': approval_id},
                UpdateExpression="SET #status = :newStatus, decision_at = :now",
                ConditionExpression="#status = :pending",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":newStatus": status,
                    ":pending": "PENDING",
                    ":now": int(time.time() * 1000)
                },
                ReturnValues="ALL_NEW"
            )
            return response.get('Attributes')
        except Exception as e:
            logger.error(f"Error updating approval record: {e}")
            # Raise exception so the route can throw 409 Conflict if not pending
            raise e
