from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class GithubToken(BaseModel):
    user_id: str
    repo_id: str
    repo_url: str
    access_token_encrypted: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    ttl: Optional[int] = None
