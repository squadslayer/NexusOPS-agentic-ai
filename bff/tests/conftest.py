import os
import pytest
from unittest.mock import patch, MagicMock

# Inject mock AWS credentials before any bff modules import boto3
os.environ["AWS_ACCESS_KEY_ID"] = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

from bff.app import create_app
from bff import config
from bff.services.github_service import github_service

@pytest.fixture(autouse=True)
def mock_github_service():
    """Globally mock github_service to prevent real calls."""
    with patch.object(github_service.token_store, "get_any_token_for_user", return_value=None), \
         patch.object(github_service.token_store, "get_token", return_value=None), \
         patch.object(github_service.oauth_service, "validate_repository_access", return_value=(False, {})):
        yield github_service

@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # Force bypass off to test auth logic
    original_bypass = config.AUTH_BYPASS
    config.AUTH_BYPASS = False

    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    yield app
    
    config.AUTH_BYPASS = original_bypass

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture(autouse=True)
def mock_boto3():
    """Mock boto3 to prevent real AWS calls during tests."""
    with patch("boto3.resource") as mock_resource:
        mock_table = MagicMock()
        mock_resource.return_value.Table.return_value = mock_table
        yield mock_resource

@pytest.fixture(autouse=True)
def mock_aws_lambda():
    """Mock boto3 lambda client."""
    with patch("boto3.client") as mock_client:
        yield mock_client
