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
        print(f"ID: {item.get('execution_id')} | User: {item.get('user_id')} | Progress: {item.get('stage')} | Repo: {item.get('repo_id')}")

    print("\nChecking ContextChunks for User Isolation...")
    table_chunks = dynamodb.Table('ContextChunks')
    response_chunks = table_chunks.scan()
    items = response_chunks.get('Items', [])
    print(f"Total Chunks: {len(items)}")
    
    # Group by user
    user_counts = {}
    for item in items:
        uid = item.get('user_id', 'MISSING')
        user_counts[uid] = user_counts.get(uid, 0) + 1
        
    for uid, count in user_counts.items():
        print(f"User: {uid} -> {count} chunks")

    if items:
        print("\nRecent 3 chunks detail:")
        for item in items[:3]:
             print(f"Chunk: {item.get('chunk_id')} | User: {item.get('user_id')} | Repo: {item.get('repo_id')}")

if __name__ == "__main__":
    check_tables()
