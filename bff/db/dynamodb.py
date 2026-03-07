import boto3
import os
from bff import config

def get_dynamodb_resource():
    """Returns a boto3 DynamoDB resource configured for the current environment.
    
    In AWS Lambda ('aws'), it uses the execution role (no explicit keys).
    In local development ('local'), it can use explicit keys if provided in .env.
    """
    resource_kwargs = {
        'region_name': config.AWS_REGION
    }
    
    if config.DYNAMODB_ENDPOINT:
        resource_kwargs['endpoint_url'] = config.DYNAMODB_ENDPOINT

    if config.CURRENT_ENV == 'aws':
        # In AWS, we MUST NOT pass explicit credentials to allow the IAM role to work
        return boto3.resource('dynamodb', **resource_kwargs)
    else:
        # Local development: allow explicit credentials from environment variables
        if os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY'):
            resource_kwargs['aws_access_key_id'] = os.getenv('AWS_ACCESS_KEY_ID')
            resource_kwargs['aws_secret_access_key'] = os.getenv('AWS_SECRET_ACCESS_KEY')
        
        return boto3.resource('dynamodb', **resource_kwargs)

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
