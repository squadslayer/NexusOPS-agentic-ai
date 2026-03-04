import pytest
from bff.utils.auth_utils import encode_jwt as generate_token
from unittest.mock import patch, MagicMock

@pytest.fixture
def auth_headers():
    token = generate_token("repo-user-1", "repo@test.com")
    return {"Authorization": f"Bearer {token}"}

@patch("bff.services.github_service.github_service.get_user_repos")
def test_get_repos_success(mock_get_repos, client, auth_headers):
    """Test GET /repos endpoint."""
    mock_get_repos.return_value = [{"id": 1, "name": "test-repo", "full_name": "test/test-repo", "permissions": {"pull": True}}]
    response = client.get("/repos", follow_redirects=True, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert "repositories" in data
    assert len(data["repositories"]) == 1
    assert data["repositories"][0]["name"] == "test-repo"

@patch("bff.services.github_service.github_service.token_store.get_any_token_for_user")
@patch("bff.services.github_service.github_service.oauth_service.validate_repository_access")
def test_execution_repo_authorization_fail(mock_validate, mock_get_token, client, auth_headers):
    """Test POST /executions/start fails when user lacks pull permission."""
    mock_get_token.return_value = "fake-token"
    mock_validate.return_value = (False, {}) # User lacks access
    
    response = client.post("/executions/start", json={"repo_id": "foo/bar"}, headers=auth_headers, follow_redirects=True)
    assert response.status_code == 403
    assert "pull access" in response.get_json()["error"]["message"].lower()

@patch("bff.services.github_service.github_service.token_store.get_any_token_for_user")
@patch("bff.services.github_service.github_service.oauth_service.validate_repository_access")
@patch("bff.routes.execution.invoke_orchestrator")
def test_execution_repo_authorization_success(mock_invoke, mock_validate, mock_get_token, client, auth_headers):
    """Test POST /executions/start succeeds when user has pull permission."""
    mock_get_token.return_value = "fake-token"
    mock_validate.return_value = (True, {"permissions": {"pull": True}})
    
    # Mock the returned envelope from orchestrator logic using a dictionary
    mock_invoke.return_value = MagicMock(success=True, to_dict=lambda: {"success": True, "data": {}, "meta": {"execution_id": "test"}})
    
    response = client.post("/executions/start", json={"repo_id": "foo/bar"}, headers=auth_headers)
    assert response.status_code == 202
