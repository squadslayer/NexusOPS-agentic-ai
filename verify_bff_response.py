import requests
import json
import sys
from pathlib import Path

# Add BFF to path
sys.path.append(str(Path(__file__).parent))

from bff.utils.auth_utils import encode_jwt

def verify_bff_response():
    user_id = "local-dev-user"
    email = "dev@nexusops.ai"
    token = encode_jwt(user_id, email)
    
    url = "http://localhost:8000/repos/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"Calling {url}...")
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("[OK] BFF returned 200")
        print(json.dumps(data, indent=2))
        
        repos = data.get("data", {}).get("repositories", [])
        statuses = [r.get("status") for r in repos]
        print(f"Found statuses: {statuses}")
        
        if "INGESTING" in statuses:
            print("[VERIFIED] BFF correctly returns INGESTING status when set in DB.")
        if "READY" in statuses:
            print("[VERIFIED] BFF correctly returns READY status when set in DB.")
    else:
        print(f"[FAIL] BFF returned {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    verify_bff_response()
