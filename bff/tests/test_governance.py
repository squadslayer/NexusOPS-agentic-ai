import pytest
from bff.utils.auth_utils import encode_jwt as generate_token
from botocore.exceptions import ClientError
from unittest.mock import MagicMock

@pytest.fixture
def auth_headers():
    token = generate_token("test-user-1", "user@test.com")
    return {"Authorization": f"Bearer {token}"}

def test_missing_repo_id(client, auth_headers):
    """Test validation blocks requests without repo_id."""
    response = client.post("/executions/start", json={"input": {}}, headers=auth_headers)
    assert response.status_code == 400
    assert "repo_id" in response.get_json()["error"]["message"]

def test_oversized_payload(client, auth_headers):
    """Test validation blocks oversized requests > 1MB."""
    large_payload = {"repo_id": "foo", "input": {"data": "x" * (1024 * 1024 + 10)}}
    response = client.post("/executions/start", json=large_payload, headers=auth_headers)
    assert response.status_code == 400
    assert "too large" in response.get_json()["error"]["message"].lower()

def test_rate_limit_exceeded(client, auth_headers, mock_boto3):
    """Test that rate limiting enforces max 5 requests."""
    # Mock dynamo ConditionalCheckFailedException on BOTH attempts to simulate a full rate limit breach
    from botocore.exceptions import ClientError
    error_response = {'Error': {'Code': 'ConditionalCheckFailedException', 'Message': 'Rate limit'}}
    mock_table = mock_boto3.return_value.Table.return_value
    mock_table.update_item.side_effect = ClientError(error_response, 'UpdateItem')
    mock_table.put_item.side_effect = ClientError(error_response, 'PutItem')
    
    response = client.post("/executions/start", json={"repo_id": "foo"}, headers=auth_headers)
    assert response.status_code == 429
    assert response.get_json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
