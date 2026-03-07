from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    APPROVAL_PENDING = "APPROVAL_PENDING"

class ExecutionRecord(BaseModel):
    user_id: str
    execution_id: str
    repo_id: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    prompt: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    duration: Optional[float] = None
    version: int = 1
