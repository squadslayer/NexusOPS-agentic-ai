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
    # DynamoDB endpoint for local testing
    DYNAMODB_ENDPOINT = "http://localhost:8000"
    
    # Logging mode for development
    LOG_LEVEL = logging.DEBUG
    
    # Bypass authentication for easier local testing
    AUTH_BYPASS = True
    
    # Inject dummy AWS credentials to completely bypass Boto3 metadata 60s timeout hangs
    os.environ['AWS_ACCESS_KEY_ID'] = 'test-local-key'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'test-local-secret'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
    
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
