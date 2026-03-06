import requests
import uuid
import time

URL = "http://localhost:8001/invoke"

def trigger_execution(user_id, repo_url):
    execution_id = str(uuid.uuid4())
    payload = {
        "execution_id": execution_id,
        "user_id": user_id,
        "repo_id": repo_url,
        "input": {
            "prompt": f"Multi-user test for {user_id}",
            "query": "Is isolation working?",
            "repository_url": repo_url
        }
    }
    print(f"Triggering for {user_id}...")
    try:
        response = requests.post(URL, json=payload, timeout=30)
        print(f"Response for {user_id}: {response.status_code}")
        # print(response.text)
    except Exception as e:
        print(f"Error for {user_id}: {e}")

if __name__ == "__main__":
    # Test with two different users
    repo = "https://github.com/octocat/Spoon-Knife"
    trigger_execution("user-alpha", repo)
    time.sleep(2)
    trigger_execution("user-beta", repo)
