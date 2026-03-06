# NexusOPS Deployment Fixes - Change Diff

**Date**: 2026-03-06  
**Purpose**: Detailed diff showing all changes made to fix P0 and P1 deployment issues

---

## Modified Files

### 1. `bff/config.py`

#### Changes Made:
1. Added 9 DynamoDB table name environment variables
2. Added production secret validation block

#### Diff:

```diff
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
ORCHESTRATOR_QUEUE_URL = os.getenv('ORCHESTRATOR_QUEUE_URL', '')

+ # DynamoDB Table Names (9 tables)
+ DYNAMODB_TABLE_USERS = os.getenv('DYNAMODB_TABLE_USERS', 'Users')
+ DYNAMODB_TABLE_GITHUB_TOKENS = os.getenv('DYNAMODB_TABLE_GITHUB_TOKENS', 'GitHubTokens')
+ DYNAMODB_TABLE_REPOSITORIES = os.getenv('DYNAMODB_TABLE_REPOSITORIES', 'Repositories')
+ DYNAMODB_TABLE_EXECUTION_RECORDS = os.getenv('DYNAMODB_TABLE_EXECUTION_RECORDS', 'ExecutionRecords')
+ DYNAMODB_TABLE_EXECUTION_LOGS = os.getenv('DYNAMODB_TABLE_EXECUTION_LOGS', 'ExecutionLogs')
+ DYNAMODB_TABLE_CONTEXT_CHUNKS = os.getenv('DYNAMODB_TABLE_CONTEXT_CHUNKS', 'ContextChunks')
+ DYNAMODB_TABLE_APPROVAL_RECORDS = os.getenv('DYNAMODB_TABLE_APPROVAL_RECORDS', 'ApprovalRecords')
+ DYNAMODB_TABLE_TOOL_REGISTRY = os.getenv('DYNAMODB_TABLE_TOOL_REGISTRY', 'ToolRegistry')
+ DYNAMODB_TABLE_RISK_REGISTRY = os.getenv('DYNAMODB_TABLE_RISK_REGISTRY', 'RiskRegistry')

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

+ # ============================================================================
+ # Production Secret Validation
+ # ============================================================================
+ 
+ if ENV == 'aws':
+     """Validate that production secrets are properly configured"""
+     insecure_defaults = {
+         'JWT_SECRET': 'your-secret-key-change-in-production',
+         'ENCRYPTION_KEY': 'your-32-byte-encryption-key-change-production',
+         'GITHUB_CLIENT_SECRET': 'dev-client-secret',
+         'GITHUB_CLIENT_ID': 'dev-client-id'
+     }
+     
+     for var_name, insecure_value in insecure_defaults.items():
+         current_value = globals().get(var_name)
+         if current_value == insecure_value:
+             raise ValueError(
+                 f"{var_name} must be set to a secure value in production. "
+                 f"Current value is the insecure default."
+             )
+     
+     # Validate JWT secret length
+     if len(JWT_SECRET) < 32:
+         raise ValueError(
+             f"JWT_SECRET must be at least 32 characters for production security. "
+             f"Current length: {len(JWT_SECRET)}"
+         )
+     
+     # Validate encryption key length (should be 32 bytes for AES-256)
+     if len(ENCRYPTION_KEY) < 32:
+         raise ValueError(
+             f"ENCRYPTION_KEY must be at least 32 characters for AES-256 encryption. "
+             f"Current length: {len(ENCRYPTION_KEY)}"
+         )
+     
+     # Validate required URLs are set
+     if not ORCHESTRATOR_QUEUE_URL:
+         logger.warning(
+             "ORCHESTRATOR_QUEUE_URL not set. System will fall back to direct Lambda invocation."
+         )
+     
+     logger.info("Production secret validation passed")
```

**Impact**: 
- Prevents hardcoded table names
- Blocks deployment with insecure secrets
- Enables environment-specific configuration

---

### 2. `bff/db/dynamodb.py`

#### Changes Made:
1. Added `get_table()` function with logical-to-physical name mapping
2. Updated to use config table names instead of hardcoded values
3. Added strict validation to prevent silent errors from typos

#### Diff:

```diff
import boto3
import os
from bff import config

def get_dynamodb_resource():
    """Returns a boto3 DynamoDB resource configured for the current environment."""
    return boto3.resource(
        'dynamodb',
        region_name=config.AWS_REGION,
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )

+ def get_table(table_key: str):
+     """Returns a boto3 Table instance using configured table names.
+     
+     Args:
+         table_key: The table identifier (e.g., 'Users', 'GitHubTokens', 'ExecutionRecords')
+     
+     Returns:
+         boto3 DynamoDB Table resource
+     
+     Example:
+         table = get_table('Users')  # Uses DYNAMODB_TABLE_USERS from config
+     """
+     dynamodb = get_dynamodb_resource()
+     
+     # Map table keys to config attributes
+     table_name_map = {
+         'Users': config.DYNAMODB_TABLE_USERS,
+         'GitHubTokens': config.DYNAMODB_TABLE_GITHUB_TOKENS,
+         'Repositories': config.DYNAMODB_TABLE_REPOSITORIES,
+         'ExecutionRecords': config.DYNAMODB_TABLE_EXECUTION_RECORDS,
+         'ExecutionLogs': config.DYNAMODB_TABLE_EXECUTION_LOGS,
+         'ContextChunks': config.DYNAMODB_TABLE_CONTEXT_CHUNKS,
+         'ApprovalRecords': config.DYNAMODB_TABLE_APPROVAL_RECORDS,
+         'ToolRegistry': config.DYNAMODB_TABLE_TOOL_REGISTRY,
+         'RiskRegistry': config.DYNAMODB_TABLE_RISK_REGISTRY,
+     }
+     
+     if table_key not in table_name_map:
+         raise ValueError(f"Unknown DynamoDB table key: {table_key}. Valid keys: {list(table_name_map.keys())}")
+     
+     table_name = table_name_map[table_key]
+     return dynamodb.Table(table_name)
```

**Impact**: 
- Repository classes use logical names
- Actual table names come from environment variables
- Supports environment-specific table naming
- **Prevents silent errors**: Typos like `get_table("ExecutionRecord")` now raise clear exceptions

---

### 3. `bff/app.py`

#### Changes Made:
1. Replaced wildcard CORS with environment-specific origins
2. Added production domain restrictions

#### Diff:

```diff
def create_app():
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=config.APP_NAME,
        version=config.VERSION,
        debug=config.DEBUG
    )
    
-   # Configure CORS for Dashboard and Landing Page
+   # Configure CORS for Dashboard and Landing Page
+   # Environment-specific origin restrictions
+   if config.CURRENT_ENV == 'aws':
+       # Production: restrict to specific domains
+       allowed_origins = [
+           "https://dashboard.nexusops.ai",
+           "https://nexusops.ai",
+           "https://www.nexusops.ai"
+       ]
+   else:
+       # Local development: allow localhost
+       allowed_origins = [
+           "http://localhost:3000",
+           "http://localhost:8000",
+           "http://127.0.0.1:3000",
+           "http://127.0.0.1:8000"
+       ]
+   
    app.add_middleware(
        CORSMiddleware,
-       allow_origins=["*"], # In production, restrict to specific domains
+       allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

**Impact**: 
- Production API only accepts requests from approved domains
- Local development remains flexible
- Prevents CORS-based attacks in production

---

## New Files Created

### 4. `bff/.env.example`

**Purpose**: Template for BFF Lambda environment variables

**Content**: Complete environment variable template with:
- AWS configuration (region, credentials)
- JWT and encryption secrets
- GitHub OAuth configuration
- Orchestrator integration settings
- DynamoDB table name overrides (9 tables)

**Lines**: 60+ environment variables documented

---

### 5. `orchestrator/.env.example`

**Purpose**: Template for Orchestrator Lambda environment variables

**Content**: Orchestrator-specific configuration with:
- AWS configuration
- Bedrock model settings
- GitHub API token
- DynamoDB table names
- Execution settings

**Lines**: 30+ environment variables documented

---

### 6. `dashboard/.env.example`

**Purpose**: Template for Next.js dashboard configuration

**Content**: Frontend configuration with:
- API endpoint URLs
- Public environment variables
- Feature flags
- Analytics configuration

**Lines**: 15+ environment variables documented

---

### 7. `IAM/bff-lambda-role.json`

**Purpose**: Least-privilege IAM policy for BFF Lambda

**Permissions Granted**:
- DynamoDB: `GetItem`, `PutItem`, `UpdateItem`, `Query`, `Scan` on 9 tables
- SQS: `SendMessage` to orchestrator queue
- CloudWatch Logs: Via AWSLambdaBasicExecutionRole

**Resource Restrictions**: All ARNs scoped to specific resources

**Lines**: ~80 lines of JSON policy

---

### 8. `IAM/orchestrator-lambda-role.json`

**Purpose**: Comprehensive IAM policy for Orchestrator Lambda

**Permissions Granted**:
- DynamoDB: Full CRUD on 9 tables
- Bedrock: `InvokeModel` for Claude models
- CloudWatch Logs: Via AWSLambdaBasicExecutionRole

**Resource Restrictions**: Bedrock limited to specific model families

**Lines**: ~90 lines of JSON policy

---

### 9. `IAM/README.md`

**Purpose**: Complete IAM deployment guide

**Sections**:
1. Overview of IAM requirements
2. Step-by-step deployment instructions
3. AWS CLI commands for role creation
4. Policy attachment procedures
5. Resource ARN customization guide
6. Lambda deployment examples
7. Permission breakdown
8. Security best practices
9. Environment variable reference
10. Verification procedures
11. Troubleshooting guide

**Lines**: 400+ lines of comprehensive documentation

---

## Repository Files (No Changes Needed)

### `bff/repositories/execution_repository.py`
- ✅ Already using `get_table('ExecutionRecords')`
- ✅ Correctly implements logical table name pattern

### `bff/repositories/token_repository.py`
- ✅ Already using `get_table('GitHubTokens')`
- ✅ Correctly uses `user_id` and `repo_id` as keys (NOT provider)

### `bff/repositories/repo_repository.py`
- ✅ Already using `get_table('Repositories')`
- ✅ Correctly implements logical table name pattern

---

## Summary Statistics

### Modified Files: 3
- `bff/config.py` - Added 9 table variables + validation block (~40 lines added)
- `bff/db/dynamodb.py` - Added `get_table()` function (~30 lines added)
- `bff/app.py` - Updated CORS configuration (~15 lines changed)

### New Files: 6
- `bff/.env.example` - 60+ lines
- `orchestrator/.env.example` - 30+ lines
- `dashboard/.env.example` - 15+ lines
- `IAM/bff-lambda-role.json` - 80+ lines
- `IAM/orchestrator-lambda-role.json` - 90+ lines
- `IAM/README.md` - 400+ lines

### Total Lines Added: ~750 lines
### Total Lines Modified: ~55 lines
### Files Verified (No Changes): 3 repository classes

---

## Change Categories

### Security Enhancements
- ✅ Production secret validation (prevents insecure deployments)
- ✅ CORS restrictions (prevents unauthorized API access)
- ✅ IAM least-privilege policies (minimizes attack surface)

### Configuration Improvements
- ✅ Externalized table names (supports multi-environment)
- ✅ Environment variable templates (clear deployment requirements)
- ✅ Comprehensive documentation (reduces deployment errors)

### Architecture Improvements
- ✅ Logical-to-physical table name mapping (cleaner code)
- ✅ Environment-aware configuration (single codebase, multiple environments)
- ✅ Deployment automation support (IAM policies ready for IaC)

---

## Testing Impact

### No Breaking Changes
- All existing code continues to work
- Repository classes already used correct patterns
- New validation only affects production deployment

### New Validation Points
1. Production deployment will fail if secrets are insecure (expected behavior)
2. CORS will reject requests from unauthorized origins in production
3. IAM policies enforce least-privilege access

### Backward Compatibility
- ✅ Default table names match existing values
- ✅ Local development unchanged
- ✅ Existing tests continue to pass

---

## Deployment Checklist

### Before Deployment
- [ ] Review all `.env.example` files
- [ ] Generate production secrets (JWT, encryption key)
- [ ] Configure GitHub OAuth app
- [ ] Customize IAM policy ARNs
- [ ] Create DynamoDB tables
- [ ] Create SQS queue

### During Deployment
- [ ] Create IAM roles using provided policies
- [ ] Set environment variables in Lambda configuration
- [ ] Deploy Lambda functions with correct roles
- [ ] Configure API Gateway
- [ ] Deploy dashboard with production API endpoint

### After Deployment
- [ ] Verify health endpoints
- [ ] Test GitHub OAuth flow
- [ ] Test repository connection
- [ ] Test execution workflow
- [ ] Monitor CloudWatch Logs

---

## Risk Assessment

### Low Risk Changes
- Table name externalization (defaults match existing)
- Environment variable templates (documentation only)
- IAM policies (new files, no existing code affected)

### Medium Risk Changes
- CORS restrictions (may block unauthorized clients - intended behavior)
- Production secret validation (will fail on insecure secrets - intended behavior)

### Mitigation Strategies
- All changes tested locally with ENV=local
- Production validation can be tested with ENV=aws before deployment
- CORS changes are environment-specific (local development unaffected)
- Comprehensive documentation reduces deployment errors

---

## Rollback Plan

If issues occur in production:

1. **CORS Issues**: Update `allowed_origins` in `bff/app.py` and redeploy
2. **Table Name Issues**: Set correct table names in Lambda environment variables
3. **Secret Validation Issues**: Set production secrets in Lambda environment variables
4. **IAM Permission Issues**: Update IAM policies and wait for propagation (~60 seconds)

No database migrations or schema changes required for rollback.

---

## Next Steps

### Immediate (Required for Deployment)
1. Create production secrets
2. Create AWS resources (DynamoDB, SQS)
3. Deploy IAM roles
4. Deploy Lambda functions

### Short-term (P2 Improvements)
1. Add Bedrock retry logic
2. Audit reserved word aliasing
3. Add GitHub rate limiting
4. Configure SQS DLQ
5. Set Lambda provisioned concurrency

### Long-term (Optimizations)
1. Consider single-table DynamoDB design
2. Implement caching layer
3. Add monitoring and alerting
4. Implement automated testing in CI/CD

---

**End of Change Diff**
