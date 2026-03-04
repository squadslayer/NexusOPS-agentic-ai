import pytest
from bff.utils.auth_utils import encode_jwt as generate_token

def test_missing_auth_header(client):
    """Test POST /executions/start without auth header."""
    response = client.post("/executions/start", json={"repo_id": "foo", "input": {}})
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "AUTH_ERROR"

def test_invalid_auth_token(client):
    """Test POST /executions/start with an invalid token."""
    headers = {"Authorization": "Bearer invalid_gibberish"}
    response = client.post("/executions/start", json={"repo_id": "foo"}, headers=headers)
    assert response.status_code == 401
    assert response.get_json()["error"]["message"] == "Invalid authentication token"

def test_valid_auth_token(client):
    """Test successful token validation bypassing auth (but failing downstream on validation/repo)."""
    token = generate_token("test-user-123", "test@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/executions/start", json={"repo_id": "foo", "input": {}}, headers=headers)
    # Shouldn't fail auth. Should fail Repo check (403 or 400).
    assert response.status_code in [400, 403, 502]
