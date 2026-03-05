import boto3
import os
from bff.config import AWS_REGION

def get_dynamodb_resource():
    """Returns a boto3 DynamoDB resource configured for the current environment."""
    return boto3.resource(
        'dynamodb',
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )

def get_table(table_name):
    """Returns a boto3 Table instance."""
    dynamodb = get_dynamodb_resource()
    return dynamodb.Table(table_name)
