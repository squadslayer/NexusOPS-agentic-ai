"""Configuration settings for BFF.

This module acts as the brain for environment configuration, safely switching between
local development and AWS production environments based on the ENV environment variable.
"""

import os
import logging


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

# GitHub settings
GITHUB_API_BASE_URL = "https://api.github.com"

# Orchestrator service settings
ORCHESTRATOR_SERVICE_URL = os.getenv('ORCHESTRATOR_SERVICE_URL', 'http://localhost:5001')

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
