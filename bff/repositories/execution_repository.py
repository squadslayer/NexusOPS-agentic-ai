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
        """Updates the status and results of an execution."""
        try:
            update_expression = "SET #stat = :s, updated_at = :u"
            expression_values = {
                ":s": status.value,
                ":u": datetime.utcnow().isoformat()
            }
            expression_names = {"#stat": "status"}

            if result is not None:
                update_expression += ", #res = :r"
                expression_values[":r"] = result
                expression_names["#res"] = "result"
            
            self.table.update_item(
                Key={'user_id': user_id, 'execution_id': execution_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values,
                ExpressionAttributeNames=expression_names
            )
            return True
        except Exception as e:
            logger.error(f"Error updating execution: {e}")
            return False

    def get_execution(self, execution_id: str):
        """Retrieves an execution record by ID using the GSI."""
        try:
            response = self.table.query(
                IndexName="GSI1",
                KeyConditionExpression="execution_id = :eid",
                ExpressionAttributeValues={":eid": execution_id}
            )
            items = response.get('Items', [])
            if items:
                item = items[0]
                item['created_at'] = datetime.fromisoformat(item['created_at'])
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
                return ExecutionRecord(**item)
            return None
        except Exception as e:
            logger.error(f"Error retrieving execution: {e}")
            return None
