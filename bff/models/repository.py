from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class RepositoryStatus(str, Enum):
    CONNECTING = "CONNECTING"
    READY = "READY"
    INGESTING = "INGESTING"
    ERROR = "ERROR"

class Repository(BaseModel):
    user_id: str
    repo_id: str
    repo_name: str
    repo_url: str
    provider: str = "github"
    default_branch: str
    connected_at: datetime = Field(default_factory=datetime.utcnow)
    status: RepositoryStatus = RepositoryStatus.READY
    last_sync_at: Optional[datetime] = None
