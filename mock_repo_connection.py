import boto3
import sys
from pathlib import Path
from datetime import datetime

# Add BFF to path
sys.path.append(str(Path(__file__).parent))

from bff import config
from bff.models.repository import Repository, RepositoryStatus
from bff.repositories.repo_repository import RepoRepository
from bff.services.github_service import TokenEncryptionService
from bff.repositories.token_repository import TokenRepository
from bff.models.github_token import GithubToken

def mock_connection(user_id="local-dev-user", status=RepositoryStatus.READY):
    print(f"=== Mocking Repository Connection (Status: {status}) ===")
    
    repo_url = f"https://github.com/squadslayer/mock-repo-{status.lower()}"
    repo_name = f"mock-repo-{status.lower()}"
    repo_id = str(hash(repo_url))
    
    # 1. Store Repository
    repo_repo = RepoRepository()
    repo_data = Repository(
        user_id=user_id,
        repo_id=repo_id,
        repo_name=repo_name,
        repo_url=repo_url,
        default_branch="main",
        status=status
    )
    
    success = repo_repo.store_repository(repo_data)
    if success:
        print(f"[OK] Stored repository: {repo_name} (ID: {repo_id})")
    else:
        print(f"[FAIL] Failed to store repository")
        return

    # 2. Store Mock Token
    encryption_service = TokenEncryptionService()
    encrypted_token = encryption_service.encrypt_token("ghp_mock_token_for_verification")
    
    token_repo = TokenRepository()
    token_data = GithubToken(
        user_id=user_id,
        repo_id=repo_id,
        repo_url=repo_url,
        access_token_encrypted=encrypted_token
    )
    
    try:
        token_repo.store_token(token_data)
        print(f"[OK] Stored mock encrypted token for repo")
    except Exception as e:
        print(f"[FAIL] Failed to store token: {e}")

if __name__ == "__main__":
    # Create one READY and one INGESTING repo for testing
    mock_connection(status=RepositoryStatus.READY)
    mock_connection(status=RepositoryStatus.INGESTING)
