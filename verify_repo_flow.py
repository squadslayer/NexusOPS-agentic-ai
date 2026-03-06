import requests
import json
import time
import os
import sys
from pathlib import Path

# Add BFF to path so we can use its utilities
sys.path.append(str(Path(__file__).parent))

from bff.utils.auth_utils import encode_jwt
from bff.repositories.repo_repository import RepoRepository
from bff.models.repository import RepositoryStatus

def verify_repo_connection():
    print("=== NexusOPS Repository Flow Verification ===")
    
    # 1. Generate JWT for test user
    user_id = "test-user-verify"
    email = "verify@nexusops.ai"
    token = encode_jwt(user_id, email)
    print(f"Generated test JWT for user: {user_id}")

    # 2. Prepare request
    base_url = "http://localhost:8000"
    repo_url = "https://github.com/squadslayer/NexusOPS-agentic-ai"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "repo_url": repo_url,
        "code": "mock-oauth-code"
    }

    print(f"Connecting repository: {repo_url}...")
    
    try:
        # We need to make sure the BFF is running, but for this script 
        # we can also test the RepoRepository directly if the server isn't up.
        
        # 3. Call BFF (assuming it's running)
        response = requests.post(f"{base_url}/repos/connect", json=payload, headers=headers)
        
        if response.status_code == 200:
            print("[OK] BFF: /repos/connect returned 200 OK")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"[FAIL] BFF: /repos/connect failed with status {response.status_code}")
            print(response.text)
            # Fallback: Check if we can proceed with direct DB check anyway
            
        # 4. Verify in DynamoDB
        print("\nChecking DynamoDB for repository record...")
        repo_repo = RepoRepository()
        repos = repo_repo.get_user_repositories(user_id)
        
        found = False
        for r in repos:
            if r.repo_url == repo_url:
                found = True
                print(f"[OK] Found repository in DB: {r.repo_name}")
                print(f"   Status: {r.status}")
                
                # VERIFICATION POINT: Context Ingestion
                if r.status == RepositoryStatus.INGESTING:
                    print("[SYNC] Repository is INGESTING (Searching for context files...)")
                elif r.status == RepositoryStatus.READY:
                    print("[WARN] Repository is READY immediately (Skipped INGESTING status)")
                
                break
        
        if not found:
            print(f"[FAIL] Repository {repo_url} not found in DB for user {user_id}")

        # 5. Check for orchestrator context file
        repo_id = str(hash(repo_url)) # Simplified repo_id logic from bff/routes/repo.py
        context_dir = Path("orchestrator/context")
        context_file = context_dir / f"{repo_id}.json"
        
        print(f"\nChecking for context file: {context_file}")
        if context_file.exists():
            print(f"[OK] Context file exists: {context_file}")
        else:
            print(f"[FAIL] Context file NOT found: {context_file}")
            print("   (This confirms context ingestion is either missing or asynchronous)")

    except Exception as e:
        print(f"[ERROR] Error during verification: {str(e)}")

if __name__ == "__main__":
    verify_repo_connection()
