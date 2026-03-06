import requests
import uuid
import time
import threading
import boto3
from datetime import datetime
from bff import config

BASE_URL = 'http://localhost:8000'
USER_ID = 'local-dev-user'
HEADERS = {'Authorization': f'Bearer {USER_ID}'}

def setup_database():
    """Inject mock data into DynamoDB for the test user"""
    print("--- Setting up test data in DynamoDB ---")
    from bff.services.github_service import TokenEncryptionService
    encryption_service = TokenEncryptionService()
    
    dynamodb = boto3.resource('dynamodb', region_name=config.AWS_REGION)
    
    # 1. Inject Encrypted Token
    token_table = dynamodb.Table(config.DYNAMODB_TABLE_GITHUB_TOKENS)
    raw_token = 'mock-github-token'
    encrypted_token = encryption_service.encrypt_token(raw_token)
    
    token_table.put_item(Item={
        'user_id': USER_ID,
        'repo_id': 'all',
        'encrypted_token': encrypted_token,
        'connected_at': datetime.utcnow().isoformat()
    })
    print("DONE: Injected mock encrypted GitHub token")

    # 2. Inject Repository
    repo_table = dynamodb.Table(config.DYNAMODB_TABLE_REPOSITORIES)
    repo_table.put_item(Item={
        'user_id': USER_ID,
        'repo_id': 'test/integration-repo',
        'url': 'https://github.com/test/integration-repo',
        'connected_at': datetime.utcnow().isoformat()
    })
    repo_table.put_item(Item={
        'user_id': USER_ID,
        'repo_id': 'test/approval-repo',
        'url': 'https://github.com/test/approval-repo',
        'connected_at': datetime.utcnow().isoformat()
    })
    repo_table.put_item(Item={
        'user_id': USER_ID,
        'repo_id': 'test/lock-repo',
        'url': 'https://github.com/test/lock-repo',
        'connected_at': datetime.utcnow().isoformat()
    })
    print("DONE: Injected mock repositories")

def test_execution_creation_and_listing():
    print("\n--- Test Case 1: Execution Creation & Listing ---")
    
    # 1. Start execution
    payload = {
        "repo_id": "test/integration-repo",
        "input": {
            "prompt": "List all S3 buckets"
        }
    }
    response = requests.post(f"{BASE_URL}/executions/start", json=payload, headers=HEADERS)
    assert response.status_code == 200, f"Creation failed: {response.text}"
    assert response.json()['success'], f"Creation returned success=False: {response.json()}"
    
    execution_data = response.json()['data']
    execution_id = execution_data['execution_id']
    print(f"SUCCESS: Started execution: {execution_id}")
    
    # 2. List executions (filtering by status PENDING)
    response = requests.get(f"{BASE_URL}/executions?repo_id=test/integration-repo", headers=HEADERS)
    assert response.status_code == 200, f"Listing failed: {response.text}"
    assert response.json()['success']
    
    executions = response.json()['data']
    print(f"Debug: executions type: {type(executions)}")
    if executions:
        print(f"Debug: first item keys: {executions[0].keys()}")
    
    found = any(e['execution_id'] == execution_id for e in executions)
    assert found, f"Created execution {execution_id} not found in list"
    print(f"SUCCESS: Execution found in list (Total matching repo: {len(executions)})")

def test_approval_workflow():
    print("\n--- Test Case 2: Approval Workflow ---")
    
    # 1. Create execution
    payload = {
        "repo_id": "test/approval-repo", 
        "input": {"prompt": "Delete old resources"}
    }
    res_obj = requests.post(f"{BASE_URL}/executions/start", json=payload, headers=HEADERS)
    assert res_obj.status_code == 200
    assert res_obj.json()['success']
    res = res_obj.json()
    execution_id = res['data']['execution_id']
    
    # 2. Manually inject a PENDING approval record
    print(f"Injecting PENDING approval for {execution_id}...")
    dynamodb = boto3.resource('dynamodb', region_name=config.AWS_REGION)
    approval_table = dynamodb.Table(config.DYNAMODB_TABLE_APPROVAL_RECORDS)
    approval_id = str(uuid.uuid4())
    approval_table.put_item(Item={
        'approval_id': approval_id,
        'execution_id': execution_id,
        'status': 'PENDING',
        'proposed_changes': 'rm -rf /old-stuff',
        'created_at': datetime.utcnow().isoformat(),
        'version': 1
    })
    
    # 3. Verify approval shows up in BFF
    response = requests.get(f"{BASE_URL}/executions/{execution_id}/approval", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()['success']
    approval_data = response.json()['data']
    assert approval_data['status'] == 'PENDING'
    print("SUCCESS: Approval record retrieved from BFF")
    
    # 4. Approve via BFF
    response = requests.post(f"{BASE_URL}/executions/{execution_id}/approve", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()['success']
    print("SUCCESS: Approval successful via BFF")
    
    # 5. Verify status updated
    response = requests.get(f"{BASE_URL}/executions/{execution_id}/approval", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()['success']
    assert response.json()['data']['status'] == 'APPROVED'
    print("SUCCESS: Approval status verified as APPROVED")

def test_optimistic_locking_concurrency():
    print("\n--- Test Case 3: Optimistic Locking Concurrency ---")
    
    # 1. Create execution and approval
    res_obj = requests.post(f"{BASE_URL}/executions/start", json={"repo_id": "test/lock-repo", "input": {"prompt": "test"}}, headers=HEADERS)
    assert res_obj.status_code == 200
    assert res_obj.json()['success']
    res = res_obj.json()
    execution_id = res['data']['execution_id']
    
    dynamodb = boto3.resource('dynamodb', region_name=config.AWS_REGION)
    approval_table = dynamodb.Table(config.DYNAMODB_TABLE_APPROVAL_RECORDS)
    approval_id = str(uuid.uuid4())
    approval_table.put_item(Item={
        'approval_id': approval_id,
        'execution_id': execution_id,
        'status': 'PENDING',
        'version': 1
    })
    
    results = []
    
    def approve():
        try:
            # We hit the approve endpoint which uses update_approval_status with version check
            response = requests.post(
                f"{BASE_URL}/executions/{execution_id}/approve",
                headers=HEADERS
            )
            results.append(response.status_code)
        except Exception as e:
            results.append(str(e))

    print("Sending concurrent approval requests...")
    t1 = threading.Thread(target=approve)
    t2 = threading.Thread(target=approve)
    
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    
    print(f"Results: {results}")
    
    # Check for expected race condition handling
    success = results.count(200)
    conflict = results.count(409)
    
    print(f"Successes: {success}, Conflicts: {conflict}")
    assert success == 1, f"Expected exactly 1 success, got {success}"
    assert conflict == 1, f"Expected exactly 1 conflict (409), got {conflict}"
    print("SUCCESS: Optimistic locking verified!")

if __name__ == "__main__":
    try:
        setup_database()
        test_execution_creation_and_listing()
        test_approval_workflow()
        test_optimistic_locking_concurrency()
        print("\nPASS: All integration tests passed! System is robust.")
    except AssertionError as e:
        print(f"\nFAIL: Test failed: {e}")
    except Exception as e:
        print(f"\nERROR: Unexpected error: {e}")
