import boto3
import os
from bff import config

def get_dynamodb_resource():
    """Returns a boto3 DynamoDB resource configured for the current environment.
    
    Note: In Lambda, credentials are automatically provided via the execution role.
    Explicit credentials are only used for local development.
    """
    # In AWS Lambda, use IAM role credentials (no explicit credentials needed)
    # In local development, use credentials from environment or ~/.aws/credentials
    if config.CURRENT_ENV == 'aws':
        return boto3.resource(
            'dynamodb',
            region_name=config.AWS_REGION
        )
    else:
        # Local development: allow explicit credentials if provided
        return boto3.resource(
            'dynamodb',
            region_name=config.AWS_REGION,
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )

def get_table(table_key: str):
    """Returns a boto3 Table instance using configured table names.
    
    Args:
        table_key: The table identifier (e.g., 'Users', 'GitHubTokens', 'ExecutionRecords')
    
    Returns:
        boto3 DynamoDB Table resource
    
    Example:
        table = get_table('Users')  # Uses DYNAMODB_TABLE_USERS from config
    """
    dynamodb = get_dynamodb_resource()
    
    # Map table keys to config attributes
    table_name_map = {
        'Users': config.DYNAMODB_TABLE_USERS,
        'GitHubTokens': config.DYNAMODB_TABLE_GITHUB_TOKENS,
        'Repositories': config.DYNAMODB_TABLE_REPOSITORIES,
        'ExecutionRecords': config.DYNAMODB_TABLE_EXECUTION_RECORDS,
        'ExecutionLogs': config.DYNAMODB_TABLE_EXECUTION_LOGS,
        'ContextChunks': config.DYNAMODB_TABLE_CONTEXT_CHUNKS,
        'ApprovalRecords': config.DYNAMODB_TABLE_APPROVAL_RECORDS,
        'ToolRegistry': config.DYNAMODB_TABLE_TOOL_REGISTRY,
        'RiskRegistry': config.DYNAMODB_TABLE_RISK_REGISTRY,
    }
    
    if table_key not in table_name_map:
        raise ValueError(f"Unknown DynamoDB table key: {table_key}. Valid keys: {list(table_name_map.keys())}")
    
    table_name = table_name_map[table_key]
    return dynamodb.Table(table_name)
