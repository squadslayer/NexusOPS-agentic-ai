import boto3
from botocore.exceptions import ClientError
import logging
import os
from dotenv import load_dotenv

# Load credentials from bff/.env
load_dotenv(os.path.join(os.path.dirname(__file__), 'bff', '.env'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

dynamodb = boto3.client(
    'dynamodb',
    region_name=os.getenv('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

def delete_table_if_exists(table_name):
    try:
        dynamodb.delete_table(TableName=table_name)
        waiter = dynamodb.get_waiter('table_not_exists')
        waiter.wait(TableName=table_name)
        logger.info(f"Deleted existing '{table_name}' table.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            logger.info(f"Table '{table_name}' does not exist, skipping deletion.")
        else:
            logger.error(f"Error checking/deleting '{table_name}': {e}")
            raise e

def create_github_tokens():
    table_name = 'GitHubTokens'
    delete_table_if_exists(table_name)
    
    logger.info(f"Creating '{table_name}' table...")
    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'user_id', 'KeyType': 'HASH'},  # Partition key
            {'AttributeName': 'repo_id', 'KeyType': 'RANGE'}   # Sort key
        ],
        AttributeDefinitions=[
            {'AttributeName': 'user_id', 'AttributeType': 'S'},
            {'AttributeName': 'repo_id', 'AttributeType': 'S'}
        ],
        ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
    )
    
    # Wait for the table to be active before enabling TTL
    logger.info(f"Waiting for '{table_name}' to become ACTIVE...")
    waiter = dynamodb.get_waiter('table_exists')
    waiter.wait(TableName=table_name)
    
    # Enable TTL on the new table
    dynamodb.update_time_to_live(
        TableName=table_name,
        TimeToLiveSpecification={
            'Enabled': True,
            'AttributeName': 'ttl'
        }
    )
    logger.info(f"Successfully created '{table_name}' with TTL enabled.")

def create_repositories():
    table_name = 'Repositories'
    delete_table_if_exists(table_name)
    
    logger.info(f"Creating '{table_name}' table...")
    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'user_id', 'KeyType': 'HASH'},  # Partition key
            {'AttributeName': 'repo_id', 'KeyType': 'RANGE'}   # Sort key
        ],
        AttributeDefinitions=[
            {'AttributeName': 'user_id', 'AttributeType': 'S'},
            {'AttributeName': 'repo_id', 'AttributeType': 'S'}
        ],
        ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
    )
    logger.info(f"Successfully created '{table_name}'.")

def create_execution_records():
    table_name = 'ExecutionRecords'
    delete_table_if_exists(table_name)
    
    logger.info(f"Creating '{table_name}' table with GSI...")
    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'user_id', 'KeyType': 'HASH'},
            {'AttributeName': 'execution_id', 'KeyType': 'RANGE'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'user_id', 'AttributeType': 'S'},
            {'AttributeName': 'execution_id', 'AttributeType': 'S'}
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'GSI1',
                'KeySchema': [{'AttributeName': 'execution_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            }
        ],
        ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
    )
    logger.info(f"Successfully created '{table_name}' with GSI1.")

if __name__ == "__main__":
    logger.info("Starting DynamoDB Table Provisioning...")
    # 1. Create GitHubTokens with PK/SK
    create_github_tokens()
    # 2. Create Repositories with PK/SK
    create_repositories()
    # 3. Force recreate ExecutionRecords with GSI
    create_execution_records()
    logger.info("Provisioning complete!")
