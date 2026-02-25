"""Standard Request Envelope schema for Track 2: API Contract Design.

This module enforces the inclusion of UUID fields for request tracking,
ensuring every inbound request can be traced through the system.
"""

import uuid
from typing import Optional, Any, Dict
from dataclasses import dataclass, field


@dataclass
class StandardRequestEnvelope:
    """
    Standard Request Envelope schema that enforces strict contracts.
    
    All inbound requests MUST include:
    - request_id (UUID): Unique identifier for request tracking
    - correlation_id (UUID): ID for tracking related requests across services
    - payload: The actual request data
    
    Attributes:
        request_id (str): Unique UUID for this specific request
        correlation_id (str): UUID for tracking related requests
        timestamp (str): ISO 8601 timestamp when request was created
        payload (Dict): The actual request data
        metadata (Dict): Optional metadata about the request
    """
    
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: __import__('datetime').datetime.utcnow().isoformat())
    payload: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'StandardRequestEnvelope':
        """
        Create a StandardRequestEnvelope from a dictionary (e.g., from Flask request).
        
        If request_id or correlation_id are not provided, they are auto-generated.
        
        Args:
            data (Dict): Dictionary containing request data
            
        Returns:
            StandardRequestEnvelope: Validated envelope with tracked UUIDs
            
        Example:
            envelope = StandardRequestEnvelope.from_dict({
                'request_id': 'abc123...',
                'payload': {'action': 'start_execution'}
            })
        """
        return cls(
            request_id=data.get('request_id', str(uuid.uuid4())),
            correlation_id=data.get('correlation_id', str(uuid.uuid4())),
            timestamp=data.get('timestamp', __import__('datetime').datetime.utcnow().isoformat()),
            payload=data.get('payload', {}),
            metadata=data.get('metadata', {})
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert envelope to dictionary for logging or serialization.
        
        Returns:
            Dict: Dictionary representation of the envelope
        """
        return {
            'request_id': self.request_id,
            'correlation_id': self.correlation_id,
            'timestamp': self.timestamp,
            'payload': self.payload,
            'metadata': self.metadata
        }
    
    def validate(self) -> bool:
        """
        Validate that all required UUID fields are present and valid.
        
        Returns:
            bool: True if all UUIDs are valid
            
        Raises:
            ValueError: If any UUID is invalid or missing
        """
        try:
            # Validate request_id is a valid UUID
            uuid.UUID(self.request_id)
            # Validate correlation_id is a valid UUID
            uuid.UUID(self.correlation_id)
            return True
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid UUID fields in request envelope: {str(e)}")
