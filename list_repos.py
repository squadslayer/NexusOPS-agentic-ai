import boto3
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load credentials from bff/.env
load_dotenv(os.path.join(os.path.dirname(__file__), 'bff', '.env'))

def list_repos():
    region = os.getenv('AWS_REGION', 'us-east-1')
    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table('Repositories')
    
    print(f"Scanning table: Repositories in region: {region}...")
    try:
        response = table.scan()
        items = response.get('Items', [])
        print(f"Found {len(items)} items in total.")
        for i in items:
            print(f"User: {i.get('user_id')} | Repo: {i.get('repo_name')} | Status: {i.get('status')}")
    except Exception as e:
        print(f"Error scanning table: {e}")

if __name__ == "__main__":
    list_repos()
