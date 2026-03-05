import json
import boto3
import logging
from typing import Dict, Any, Optional
from bff import config

logger = logging.getLogger(__name__)

class SQSClient:
    def __init__(self):
        self.sqs = boto3.client(
            'sqs',
            region_name=config.AWS_REGION
        )
        self.queue_url = config.ORCHESTRATOR_QUEUE_URL

    def send_execution_request(self, payload: Dict[str, Any]) -> Optional[str]:
        """
        Sends an execution request to the SQS queue.
        """
        if not self.queue_url:
            logger.error("SQS Queue URL not configured")
            return None

        try:
            response = self.sqs.send_message(
                QueueUrl=self.queue_url,
                MessageBody=json.dumps(payload),
                MessageAttributes={
                    'execution_id': {
                        'DataType': 'String',
                        'StringValue': payload.get('execution_id', 'unknown')
                    }
                }
            )
            message_id = response.get('MessageId')
            logger.info(f"Execution request sent to SQS: {message_id}")
            return message_id
        except Exception as e:
            logger.error(f"Error sending message to SQS: {str(e)}")
            return None

sqs_client = SQSClient()
