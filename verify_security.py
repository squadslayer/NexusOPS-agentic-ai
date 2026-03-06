import requests
import uuid
import time
import boto3
import os
from dotenv import load_dotenv

load_dotenv(os.path.join('bff', '.env'))

# --- 1. SETUP MOCK TOKENS IN DYNAMODB ---
dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.getenv('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

def setup_mock_tokens():
    table = dynamodb.Table('GitHubTokens')
    print("Setting up mock token for user-alpha...")
    # user-alpha has a "valid" token (mock)
    table.put_item(Item={
        'user_id': 'user-alpha',
        'repo_id': 'GLOBAL', # General token
        'access_token': os.getenv('GITHUB_API_TOKEN', 'YOUR_GITHUB_PAT_HERE'),
        'created_at': '2026-03-06T00:00:00Z',
        'updated_at': '2026-03-06T00:00:00Z'
    })
    
    # user-beta has NO token or a "wrong" token
    print("Ensuring user-beta has no valid tokens...")
    table.delete_item(Key={'user_id': 'user-beta', 'repo_id': 'GLOBAL'})

# --- 2. EXECUTION TRIGGERS ---
ORCHESTRATOR_URL = "http://localhost:8001/invoke"

def run_test_execution(user_id, repo_url, prompt):
    exec_id = str(uuid.uuid4())
    payload = {
        "execution_id": exec_id,
        "user_id": user_id,
        "repo_id": repo_url,
        "input": {
            "prompt": prompt,
            "query": "Give me the README summary",
            "repository_url": repo_url
        }
    }
    print(f"\n[TEST] Running execution for {user_id}...")
    try:
        # Use timeout because local bridge loops stages
        response = requests.post(ORCHESTRATOR_URL, json=payload, timeout=60)
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

# --- 3. VERIFY DYNAMODB CONTEXT ---
def verify_isolation_in_db(repo_url):
    print(f"\n[VERIFY] Checking DynamoDB ContextChunks for {repo_url}...")
    table = dynamodb.Table('ContextChunks')
    
    # Check user-alpha chunks
    resp_alpha = table.scan(
        FilterExpression="repo_id = :rid AND user_id = :uid",
        ExpressionAttributeValues={":rid": repo_url, ":uid": "user-alpha"}
    )
    print(f"User user-alpha has {len(resp_alpha.get('Items', []))} chunks.")

    # Check user-beta chunks
    resp_beta = table.scan(
        FilterExpression="repo_id = :rid AND user_id = :uid",
        ExpressionAttributeValues={":rid": repo_url, ":uid": "user-beta"}
    )
    print(f"User user-beta has {len(resp_beta.get('Items', []))} chunks.")

if __name__ == "__main__":
    repo_to_test = "https://github.com/octocat/Spoon-Knife"
    
    # Step 1: Clear environment/setup
    setup_mock_tokens()
    
    # Step 2: User A ingests
    print("\n--- STEP 2: USER-ALPHA INGESTS REPO ---")
    run_test_execution("user-alpha", repo_to_test, "User Alpha analysis")
    
    # Step 3: User B tries to retrieve (without ingesting)
    # Even if User B triggers retrieve, they shouldn't see Alpha's chunks.
    # Our retrieveStage calls ingestRepository first. 
    # If User B doesn't have a token, ingestion might still work if repo is public.
    # But chunks will be tagged with 'user-beta'.
    
    print("\n--- STEP 3: USER-BETA ANALYZES SAME REPO ---")
    run_test_execution("user-beta", repo_to_test, "User Beta analysis")
    
    # Step 4: Final DB Check
    verify_isolation_in_db(repo_to_test)
    
    print("\n[RESULT] If User Alpha and User Beta have SEPARATE sets of chunks, isolation is confirmed.")
