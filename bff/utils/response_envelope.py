"""Standard Response Envelope formatter for Track 2: API Contract Design.

This module provides a deterministic response formatter that enforces the exact
JSON structure across all API responses. No raw Lambda responses are ever returned.
"""

from typing import Optional, Any, Dict
from dataclasses import dataclass, asdict
import json


@dataclass
class ResponseMeta:
    """Metadata attached to every response."""
    execution_id: str
    stage: str = "ASK"


@dataclass
class StandardResponseEnvelope:
    """
    Standard Response Envelope that enforces strict governance.
    
    Every single successful or failed request MUST be formatted using this structure:
    {
        "success": bool,
        "data": {},
        "error": null or error_dict,
        "meta": {
            "execution_id": "...",
            "stage": "ASK"
        }
    }
    
    Attributes:
        success (bool): Whether the request was successful
        data (Dict): Response payload (empty {} if error)
        error (Optional[Dict]): Error details if request failed
        meta (ResponseMeta): Execution tracking metadata
    """
    
    success: bool
    data: Dict[str, Any]
    error: Optional[Dict[str, Any]]
    meta: ResponseMeta
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert envelope to dictionary for JSON serialization.
        
        Returns:
            Dict: Strictly formatted response dictionary
        """
        return {
            "success": self.success,
            "data": self.data if self.success else {},
            "error": self.error if not self.success else None,
            "meta": {
                "execution_id": self.meta.execution_id,
                "stage": self.meta.stage
            }
        }
    
    def to_json(self, **kwargs) -> str:
        """
        Convert envelope to JSON string.
        
        Args:
            **kwargs: Additional arguments for json.dumps()
            
        Returns:
            str: JSON representation of the response
        """
        return json.dumps(self.to_dict(), **kwargs)


def create_success_response(
    data: Dict[str, Any],
    execution_id: str,
    stage: str = "ASK"
) -> StandardResponseEnvelope:
    """
    Create a successful response envelope.
    
    Args:
        data (Dict): The response payload to include
        execution_id (str): Unique execution ID for tracking
        stage (str): Current stage (default: "ASK")
        
    Returns:
        StandardResponseEnvelope: Formatted success response
        
    Example:
        response = create_success_response(
            data={'execution_id': '123', 'status': 'started'},
            execution_id='req-123'
        )
    """
    return StandardResponseEnvelope(
        success=True,
        data=data,
        error=None,
        meta=ResponseMeta(execution_id=execution_id, stage=stage)
    )


def create_error_response(
    error_message: str,
    error_code: str,
    execution_id: str,
    stage: str = "ASK",
    details: Optional[Dict[str, Any]] = None
) -> StandardResponseEnvelope:
    """
    Create an error response envelope.
    
    CRITICAL: Masks internal AWS errors (DynamoDB, IAM, Lambda) into generic messages.
    
    Args:
        error_message (str): Safe, generic error message
        error_code (str): Error code (e.g., "VALIDATION_ERROR")
        execution_id (str): Unique execution ID for tracking
        stage (str): Current stage (default: "ASK")
        details (Optional[Dict]): Additional error details (sanitized)
        
    Returns:
        StandardResponseEnvelope: Formatted error response
        
    Example:
        response = create_error_response(
            error_message="Failed to process request",
            error_code="INTERNAL_ERROR",
            execution_id="req-123"
        )
    """
    error_dict = {
        "message": error_message,
        "code": error_code
    }
    
    if details:
        error_dict["details"] = details
    
    return StandardResponseEnvelope(
        success=False,
        data={},
        error=error_dict,
        meta=ResponseMeta(execution_id=execution_id, stage=stage)
    )


def mask_aws_error(error: Exception) -> tuple[str, str]:
    """
    Mask internal AWS errors into safe, generic messages.
    
    GOVERNANCE RULE: No AWS error leakage.
    - DynamoDB errors → "Database operation failed"
    - IAM errors → "Access denied"
    - Lambda errors → "Service unavailable"
    - Internal errors → "Internal server error"
    
    Args:
        error (Exception): The original exception
        
    Returns:
        tuple: (safe_message, error_code)
    """
    error_str = str(error).lower()
    error_type = type(error).__name__
    
    # Check for DynamoDB errors
    if 'dynamodb' in error_str or 'botocore' in error_str:
        return ("Database operation failed", "DB_ERROR")
    
    # Check for IAM errors
    if 'iam' in error_str or 'unauthorized' in error_str:
        return ("Access denied", "AUTH_ERROR")
    
    # Check for Lambda/service errors
    if 'lambda' in error_str or 'service' in error_str:
        return ("Service unavailable", "SERVICE_ERROR")
    
    # Default to generic error
    return ("Internal server error", "INTERNAL_ERROR")
