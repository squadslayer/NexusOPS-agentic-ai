"""Configuration settings for BFF.

This module acts as the brain for environment configuration, safely switching between
local development and AWS production environments based on the ENV environment variable.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load .env from BFF directory
_bff_dir = Path(__file__).resolve().parent
load_dotenv(_bff_dir / ".env")


# Read environment variable (default to 'local' for safety)
ENV = os.getenv('ENV', 'local').lower()

# Validate ENV value
if ENV not in ['local', 'aws']:
    raise ValueError(f"Invalid ENV value: {ENV}. Expected 'local' or 'aws'.")


# ============================================================================
# Environment-based Configuration
# ============================================================================

if ENV == 'local':
    """Local Development Configuration"""
    # Use AWS default DynamoDB endpoint for local development testing against live AWS
    DYNAMODB_ENDPOINT = ""
    
    # Logging mode for development
    LOG_LEVEL = logging.DEBUG
    
    # Allow authentication bypass for easier local development testing
    AUTH_BYPASS = os.getenv('AUTH_BYPASS', 'True').lower() == 'true'
    
    # Removed dummy credential injection so that real keys from .env are used
    
    # Additional local settings
    DEBUG = True
    TESTING = True

elif ENV == 'aws':
    """AWS Production Configuration"""
    # Use AWS default DynamoDB endpoint (no local endpoint needed)
    DYNAMODB_ENDPOINT = ""
    
    # Logging mode for production
    LOG_LEVEL = logging.INFO
    
    # Strict authentication enforcement in production
    AUTH_BYPASS = False
    
    # Production settings
    DEBUG = False
    TESTING = False


# ============================================================================
# Common Configuration (applies to both environments)
# ============================================================================

# Current environment
CURRENT_ENV = ENV

# Application settings
APP_NAME = "NexusOps BFF"
VERSION = "2.0.0"

# AWS Region
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# GitHub settings
GITHUB_API_BASE_URL = "https://api.github.com"
GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID', 'dev-client-id')
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET', 'dev-client-secret')
GITHUB_REDIRECT_URI = os.getenv('GITHUB_REDIRECT_URI', 'http://localhost:8000/auth/github/callback')

# Token Encryption Configuration
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', 'your-32-byte-encryption-key-change-production')
ENCRYPTION_ALGORITHM = 'AES'

# Orchestrator service settings
ORCHESTRATOR_SERVICE_URL = os.getenv('ORCHESTRATOR_SERVICE_URL', 'http://localhost:5001')
ORCHESTRATOR_LAMBDA_NAME = os.getenv('ORCHESTRATOR_LAMBDA_NAME', 'NexusOps-Orchestrator-Phase1')
ORCHESTRATOR_LOCAL_URL = os.getenv('ORCHESTRATOR_LOCAL_URL', '')
ORCHESTRATOR_QUEUE_URL = os.getenv('ORCHESTRATOR_QUEUE_URL', '')

# DynamoDB Table Names (9 tables)
DYNAMODB_TABLE_USERS = os.getenv('DYNAMODB_TABLE_USERS', 'Users')
DYNAMODB_TABLE_GITHUB_TOKENS = os.getenv('DYNAMODB_TABLE_GITHUB_TOKENS', 'GitHubTokens')
DYNAMODB_TABLE_REPOSITORIES = os.getenv('DYNAMODB_TABLE_REPOSITORIES', 'Repositories')
DYNAMODB_TABLE_EXECUTION_RECORDS = os.getenv('DYNAMODB_TABLE_EXECUTION_RECORDS', 'ExecutionRecords')
DYNAMODB_TABLE_EXECUTION_LOGS = os.getenv('DYNAMODB_TABLE_EXECUTION_LOGS', 'ExecutionLogs')
DYNAMODB_TABLE_CONTEXT_CHUNKS = os.getenv('DYNAMODB_TABLE_CONTEXT_CHUNKS', 'ContextChunks')
DYNAMODB_TABLE_APPROVAL_RECORDS = os.getenv('DYNAMODB_TABLE_APPROVAL_RECORDS', 'ApprovalRecords')
DYNAMODB_TABLE_TOOL_REGISTRY = os.getenv('DYNAMODB_TABLE_TOOL_REGISTRY', 'ToolRegistry')
DYNAMODB_TABLE_RISK_REGISTRY = os.getenv('DYNAMODB_TABLE_RISK_REGISTRY', 'RiskRegistry')

# Logging configuration
LOGGING_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format=LOGGING_FORMAT
)

logger = logging.getLogger(__name__)
logger.info(f"BFF Configuration loaded for environment: {ENV}")
logger.debug(f"DynamoDB Endpoint: {DYNAMODB_ENDPOINT if DYNAMODB_ENDPOINT else 'AWS Default'}")
logger.debug(f"Auth Bypass: {AUTH_BYPASS}")

# ============================================================================
# Production Secret Validation
# ============================================================================

if ENV == 'aws':
    """Validate that production secrets are properly configured"""
    insecure_defaults = {
        'JWT_SECRET': 'your-secret-key-change-in-production',
        'ENCRYPTION_KEY': 'your-32-byte-encryption-key-change-production',
        'GITHUB_CLIENT_SECRET': 'dev-client-secret',
        'GITHUB_CLIENT_ID': 'dev-client-id'
    }
    
    for var_name, insecure_value in insecure_defaults.items():
        current_value = globals().get(var_name)
        if current_value == insecure_value:
            raise ValueError(
                f"{var_name} must be set to a secure value in production. "
                f"Current value is the insecure default."
            )
    
    # Validate JWT secret length
    if len(JWT_SECRET) < 32:
        raise ValueError(
            f"JWT_SECRET must be at least 32 characters for production security. "
            f"Current length: {len(JWT_SECRET)}"
        )
    
    # Validate encryption key length (should be 32 bytes for AES-256)
    if len(ENCRYPTION_KEY) < 32:
        raise ValueError(
            f"ENCRYPTION_KEY must be at least 32 characters for AES-256 encryption. "
            f"Current length: {len(ENCRYPTION_KEY)}"
        )
    
    # Validate required URLs are set
    if not ORCHESTRATOR_QUEUE_URL:
        logger.warning(
            "ORCHESTRATOR_QUEUE_URL not set. System will fall back to direct Lambda invocation."
        )
    
    logger.info("Production secret validation passed")
