# Critical Dashboard Implementation Fixes

**Date**: 2026-03-06  
**Status**: Must implement before dashboard deployment  
**Priority**: CRITICAL

---

## Overview

Three critical issues identified during technical review that must be fixed before dashboard implementation:

1. **DynamoDB GSI Indexes** - Performance issue
2. **User Isolation Security** - Security vulnerability
3. **Rate Limiting** - Cost explosion risk

---

## Issue 1: DynamoDB GSI Indexes ⚠️ CRITICAL

### Problem

**Current Implementation**:
```python
# Filtering by repo_id or status
executions = execution_repo.get_executions_by_user(
    user_id=user_id,
    repo_id=repo_id,  # Uses filter expression
    status=status      # Uses filter expression
)
```

**Issue**: Filter expressions still read ALL user executions, then filter in memory

**Performance Impact**:
```
User has 1000 executions
Filter by repo_id: Reads 1000 items, returns 50
Filter by status: Reads 1000 items, returns 100

Result: Slow queries, high DynamoDB costs
```

### Solution

**Add GSI Indexes**:

```bash
# GSI1: UserRepoIndex
aws dynamodb update-table \
  --table-name ExecutionRecords \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
    AttributeName=repo_id,AttributeType=S \
  --global-secondary-indexes \
    '[{
      "IndexName": "UserRepoIndex",
      "KeySchema": [
        {"AttributeName":"user_id","KeyType":"HASH"},
        {"AttributeName":"repo_id","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }]'

# GSI2: UserStatusIndex
aws dynamodb update-table \
  --table-name ExecutionRecords \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
    AttributeName=status,AttributeType=S \
  --global-secondary-indexes \
    '[{
      "IndexName": "UserStatusIndex",
      "KeySchema": [
        {"AttributeName":"user_id","KeyType":"HASH"},
        {"AttributeName":"status","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }]'
```

**Updated Query Pattern**:

```python
class ExecutionRepository:
    def get_executions_by_repo(self, user_id: str, repo_id: str, limit: int = 50):
        """Query using UserRepoIndex GSI"""
        response = self.table.query(
            IndexName='UserRepoIndex',
            KeyConditionExpression='user_id = :uid AND repo_id = :rid',
            ExpressionAttributeValues={':uid': user_id, ':rid': repo_id},
            Limit=limit
        )
        return [ExecutionRecord(**item) for item in response['Items']]
    
    def get_executions_by_status(self, user_id: str, status: str, limit: int = 50):
        """Query using UserStatusIndex GSI"""
        response = self.table.query(
            IndexName='UserStatusIndex',
            KeyConditionExpression='user_id = :uid AND #status = :s',
            ExpressionAttributeValues={':uid': user_id, ':s': status},
            ExpressionAttributeNames={'#status': 'status'},  # 'status' is reserved
            Limit=limit
        )
        return [ExecutionRecord(**item) for item in response['Items']]
```

**Performance Improvement**:
```
Before: Read 1000 items, filter to 50 (slow)
After:  Read 50 items directly (fast)

10x-20x performance improvement
```

### Implementation Checklist

- [ ] Add UserRepoIndex GSI to ExecutionRecords table
- [ ] Add UserStatusIndex GSI to ExecutionRecords table
- [ ] Implement `get_executions_by_repo()` method
- [ ] Implement `get_executions_by_status()` method
- [ ] Update BFF endpoint to use GSI queries
- [ ] Test query performance

---

## Issue 2: User Isolation Security ⚠️ CRITICAL

### Problem

**Vulnerable Code**:
```python
@router.get("/executions/{execution_id}")
async def get_execution(execution_id: str, user_id: str = Depends(get_current_user)):
    # ❌ WRONG - Allows execution ID guessing
    execution = execution_repo.get_execution(execution_id)
    
    if execution.user_id != user_id:
        raise HTTPException(403, "Access denied")
```

**Attack Scenario**:
```
1. User A creates execution: exec-001
2. User B guesses ID: exec-001
3. User B calls GET /executions/exec-001
4. User B can view User A's execution details
```

**Why This is Critical**:
- Execution IDs are sequential/predictable
- Exposes sensitive data (code, queries, results)
- Violates user isolation
- Compliance issue (data leakage)

### Solution

**Correct Implementation**:

```python
class ExecutionRepository:
    def get_execution(self, user_id: str, execution_id: str):
        """Get execution with user isolation
        
        CRITICAL: Requires both user_id and execution_id
        """
        response = self.table.get_item(
            Key={'user_id': user_id, 'execution_id': execution_id}
        )
        item = response.get('Item')
        if not item:
            return None
        
        # Convert datetime fields
        item['created_at'] = datetime.fromisoformat(item['created_at'])
        item['updated_at'] = datetime.fromisoformat(item['updated_at'])
        
        return ExecutionRecord(**item)
```

**Updated Endpoint**:

```python
@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get execution details with user isolation"""
    # ✅ CORRECT - Requires user_id + execution_id
    execution = execution_repo.get_execution(user_id, execution_id)
    
    if not execution:
        raise HTTPException(404, "Execution not found")
    
    return {"data": {"execution": execution.model_dump()}}
```

**Security Improvement**:
```
Before: User B can access User A's executions
After:  User B gets 404 (execution not found)

Prevents unauthorized access
```

### Implementation Checklist

- [ ] Update `get_execution()` to require `user_id` parameter
- [ ] Update all endpoints to pass `user_id` to repository
- [ ] Update `get_execution_logs()` to verify ownership
- [ ] Update `get_execution_risks()` to verify ownership
- [ ] Update `get_execution_approval()` to verify ownership
- [ ] Test unauthorized access attempts (should return 404)

---

## Issue 3: Rate Limiting ⚠️ CRITICAL

### Problem

**Vulnerable Endpoint**:
```python
@router.post("/executions")
async def create_execution(request: ExecutionRequest, user_id: str = Depends(get_current_user)):
    # ❌ NO RATE LIMITING
    execution_id = generate_execution_id()
    # ... create execution
    await orchestrator_client.submit_execution(execution_id)
```

**Attack Scenario**:
```python
# Malicious user or bug triggers 1000 executions
for i in range(1000):
    requests.post('/executions', json={
        'repo_id': 'repo-123',
        'query': f'spam {i}'
    })

# Result:
# - 1000 Lambda invocations
# - 1000 SQS messages
# - 1000 Bedrock API calls
# - $500+ in costs
```

**Why This is Critical**:
- No cost protection
- Easy to exploit (intentionally or accidentally)
- Can exhaust Lambda concurrency
- Can fill SQS queue

### Solution

**Option 1: API Gateway Throttling** (Global Protection Only)

```bash
# Configure API Gateway throttling
aws apigateway update-stage \
  --rest-api-id YOUR_API_ID \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/throttle/rateLimit,value=100 \
    op=replace,path=/throttle/burstLimit,value=200
```

**Limitation**: API Gateway throttling is GLOBAL, not per-user
- One user can consume entire quota
- Other users get blocked
- Not suitable as sole protection

**Option 2: Per-User Rate Limiting** (Recommended)

**Dual-Layer Protection**:
1. **API Gateway** (global): 100 req/sec (protects system)
2. **BFF Application** (per-user): 10 req/min per user (protects fairness)

```python
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import HTTPException

# In-memory rate limiter (simple, no external dependencies)
rate_limit_store = defaultdict(list)

def check_rate_limit(user_id: str, limit: int = 10, window: int = 60):
    """Check if user exceeded rate limit
    
    Args:
        user_id: User identifier
        limit: Max requests per window
        window: Time window in seconds
    """
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=window)
    
    # Get user's recent requests
    requests = rate_limit_store[user_id]
    
    # Remove old requests outside window
    requests = [req_time for req_time in requests if req_time > window_start]
    rate_limit_store[user_id] = requests
    
    # Check limit
    if len(requests) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {limit} executions per minute."
        )
    
    # Add current request
    requests.append(now)

@router.post("/executions")
async def create_execution(
    request: ExecutionRequest,
    user_id: str = Depends(get_current_user)
):
    """Create execution with per-user rate limiting"""
    # Check per-user rate limit
    check_rate_limit(user_id, limit=10, window=60)
    
    # Create execution
    ...
```

**Why Dual-Layer**:
```
Scenario without per-user limit:
  User A: 90 req/sec → Consumes 90% of global quota
  User B: 10 req/sec → Gets throttled by API Gateway
  Result: User A blocks everyone

Scenario with per-user limit:
  User A: 10 req/min → Isolated to their quota
  User B: 10 req/min → Protected from User A
  Result: Fair resource allocation
```

**Option 3: DynamoDB Counter** (Production-ready, no external dependencies)

```python
from datetime import datetime, timedelta
from collections import defaultdict

# In-memory rate limiter (simple, no external dependencies)
rate_limit_store = defaultdict(list)

def check_rate_limit(user_id: str, limit: int = 10, window: int = 60):
    """Check if user exceeded rate limit
    
    Args:
        user_id: User identifier
        limit: Max requests per window
        window: Time window in seconds
    """
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=window)
    
    # Get user's recent requests
    requests = rate_limit_store[user_id]
    
    # Remove old requests outside window
    requests = [req_time for req_time in requests if req_time > window_start]
    rate_limit_store[user_id] = requests
    
    # Check limit
    if len(requests) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {limit} executions per minute."
        )
    
    # Add current request
    requests.append(now)

@router.post("/executions")
async def create_execution(
    request: ExecutionRequest,
    user_id: str = Depends(get_current_user)
):
    """Create execution with rate limiting"""
    # Check rate limit
    check_rate_limit(user_id, limit=10, window=60)
    
    # Create execution
    ...
```

**Option 3: DynamoDB Counter** (Production-ready, no external dependencies)

```python
def check_rate_limit_dynamodb(user_id: str, limit: int = 10):
    """Check rate limit using DynamoDB"""
    table = get_table('RateLimits')
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=1)
    
    # Count recent executions
    response = table.query(
        KeyConditionExpression='user_id = :uid AND created_at > :start',
        ExpressionAttributeValues={
            ':uid': user_id,
            ':start': window_start.isoformat()
        },
        Select='COUNT'
    )
    
    if response['Count'] >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {limit} executions per minute."
        )
```

**Recommended Limits**:
- Rate: 10 executions/minute per user
- Burst: 20 executions (allows short spikes)
- Daily: 500 executions/day per user (optional)

### Implementation Checklist

- [ ] Choose rate limiting approach (API Gateway recommended)
- [ ] Configure API Gateway throttling (10 req/min, 20 burst)
- [ ] Add rate limit check to `POST /executions`
- [ ] Return 429 status code with clear error message
- [ ] Add rate limit headers to response
- [ ] Test rate limiting (should block after 10 requests)
- [ ] Monitor rate limit violations in CloudWatch

---

## Implementation Priority

### Week 1 (Before Dashboard Implementation)

**Day 1-2**: DynamoDB GSI Indexes
- Add UserRepoIndex GSI
- Add UserStatusIndex GSI
- Implement repository methods
- Test query performance

**Day 3**: User Isolation Security
- Update `get_execution()` method
- Update all endpoints
- Test unauthorized access

**Day 4**: Rate Limiting
- Configure API Gateway throttling
- Test rate limiting
- Monitor CloudWatch metrics

**Day 5**: Integration Testing
- Test all endpoints with fixes
- Verify performance improvements
- Verify security isolation
- Verify rate limiting

### Week 2-3: Dashboard Implementation

Proceed with dashboard implementation after all critical fixes are deployed.

---

## Testing Checklist

### GSI Performance Testing

```python
# Test 1: Query by repo_id (should use UserRepoIndex)
response = requests.get('/executions?repo_id=repo-123')
# Verify: Fast response (<100ms)

# Test 2: Query by status (should use UserStatusIndex)
response = requests.get('/executions?status=COMPLETED')
# Verify: Fast response (<100ms)

# Test 3: No filter (should use base table)
response = requests.get('/executions')
# Verify: Fast response (<100ms)
```

### Security Testing

```python
# Test 1: User A creates execution
response_a = requests.post('/executions', headers={'Authorization': 'Bearer token_a'})
execution_id = response_a.json()['data']['execution_id']

# Test 2: User B tries to access User A's execution
response_b = requests.get(f'/executions/{execution_id}', headers={'Authorization': 'Bearer token_b'})
# Verify: 404 Not Found (not 403 Forbidden - prevents info leakage)

# Test 3: User A can access own execution
response_a2 = requests.get(f'/executions/{execution_id}', headers={'Authorization': 'Bearer token_a'})
# Verify: 200 OK with execution details
```

### Rate Limiting Testing

```python
# Test 1: Send 10 requests (should succeed)
for i in range(10):
    response = requests.post('/executions', json={'repo_id': 'repo-123', 'query': f'test {i}'})
    assert response.status_code == 200

# Test 2: Send 11th request (should fail)
response = requests.post('/executions', json={'repo_id': 'repo-123', 'query': 'test 11'})
assert response.status_code == 429
assert 'Rate limit exceeded' in response.json()['detail']

# Test 3: Wait 60 seconds, try again (should succeed)
time.sleep(60)
response = requests.post('/executions', json={'repo_id': 'repo-123', 'query': 'test 12'})
assert response.status_code == 200
```

---

## Cost Impact

### Without Fixes

**Scenario**: 1000 executions triggered by bug or attack

| Service | Cost |
|---------|------|
| Lambda (Orchestrator) | $150 (1000 × 15min × $0.01) |
| Bedrock | $300 (1000 × $0.30) |
| SQS | $0.50 (1000 messages) |
| DynamoDB | $10 (slow queries) |
| **Total** | **$460.50** |

### With Fixes

**Scenario**: Rate limiting blocks after 10 executions

| Service | Cost |
|---------|------|
| Lambda (Orchestrator) | $1.50 (10 × 15min × $0.01) |
| Bedrock | $3.00 (10 × $0.30) |
| SQS | $0.01 (10 messages) |
| DynamoDB | $0.10 (fast queries with GSI) |
| **Total** | **$4.61** |

**Savings**: $455.89 (99% cost reduction)

---

## Summary

### Critical Fixes Required

1. **GSI Indexes** - Performance (10x-20x improvement)
2. **User Isolation** - Security (prevents data leakage)
3. **Rate Limiting** - Cost protection (99% cost reduction)

### Implementation Timeline

- Week 1: Implement all critical fixes
- Week 2-3: Dashboard implementation
- Total: 3 weeks

### Risk if Not Fixed

- **GSI**: Dashboard becomes slow, high DynamoDB costs
- **User Isolation**: Security vulnerability, compliance issue
- **Rate Limiting**: Cost explosion, service disruption

### Recommendation

**DO NOT proceed with dashboard implementation until all three fixes are deployed.**

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-06  
**Status**: CRITICAL - Must implement before dashboard
