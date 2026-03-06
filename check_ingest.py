import boto3
import os
from dotenv import load_dotenv

load_dotenv(os.path.join('bff', '.env'))

dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.getenv('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

def check_tables():
    print("Checking ExecutionRecords...")
    table = dynamodb.Table('ExecutionRecords')
    response = table.scan()
    items = sorted(response.get('Items', []), key=lambda x: x.get('execution_id', ''), reverse=True)
    for item in items[:5]:
        print(f"ID: {item.get('execution_id')} | Status: {item.get('status')} | Stage: {item.get('stage')} | Repo: {item.get('repo_id')}")

    print("\nChecking ContextChunks totals...")
    table_chunks = dynamodb.Table('ContextChunks')
    response_chunks = table_chunks.scan(Select='COUNT')
    print(f"Total Chunks: {response_chunks.get('Count')}")
    
    if response_chunks.get('Count') > 0:
        response_data = table_chunks.scan(Limit=5)
        for item in response_data.get('Items', []):
            print(f"Chunk ID: {item.get('chunk_id')} | Repo: {item.get('repo_id')} | Source: {item.get('source')}")

if __name__ == "__main__":
    check_tables()
