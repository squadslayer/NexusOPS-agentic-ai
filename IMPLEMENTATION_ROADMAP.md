# NexusOPS Implementation Roadmap

**Date**: 2026-03-06  
**Status**: Ready to Start  
**Total Timeline**: 3 weeks

---

## Overview

Complete implementation plan for NexusOPS dashboard integration with all critical fixes.

---

## Week 1: Critical Fixes & Infrastructure

### Day 1: DynamoDB GSI Indexes

**Tasks**:
1. Add UserRepoIndex GSI to ExecutionRecords table
2. Add UserStatusIndex GSI to ExecutionRecords table
3. Wait for GSI creation (15-30 minutes)
4. Verify GSI status

**Commands**:
```bash
# See INFRASTRUCTURE_SETUP.md for complete commands
aws dynamodb update-table --table-name ExecutionRecords ...
aws dynamodb describe-table --table-name ExecutionRecords
```

**Deliverables**:
- [ ] UserRepoIndex GSI active
- [ ] UserStatusIndex GSI active
- [ ] GSI verified in AWS Console

---

### Day 2: Repository Methods

**Tasks**:
1. Implement `get_executions_by_repo()` method
2. Implement `get_executions_by_status()` method
3. Update `get_execution()` for user isolation
4. Write unit tests

**Files**:
- `bff/repositories/execution_repository.py`

**Deliverables**:
- [ ] Repository methods implemented
- [ ] Unit tests passing
- [ ] Query performance tested

---

### Day 3: Rate Limiting

**Tasks**:
1. Configure API Gateway throttling (global protection)
2. Implement per-user rate limiting in BFF (user-specific protection)
3. Test rate limiting (global and per-user)
4. Monitor CloudWatch metrics

**API Gateway Throttling** (Global Protection):
```bash
# Protects against total system overload
aws apigateway update-stage \
  --rest-api-id YOUR_API_ID \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/throttle/rateLimit,value=100 \
    op=replace,path=/throttle/burstLimit,value=200
```

**Per-User Rate Limiting** (User-Specific Protection):
```python
# bff/middleware/rate_limit.py
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import HTTPException

# In-memory rate limiter (simple, no external dependencies)
rate_limit_store = defaultdict(list)

def check_rate_limit(user_id: str, limit: int = 10, window: int = 60):
    """Check if user exceeded rate limit
    
    Args:
        user_id: User identifier
        limit: Max requests per window (10 executions/minute)
        window: Time window in seconds (60 seconds)
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
            detail=f"Rate limit exceeded. Max {limit} executions per minute. Try again in {60 - (now - requests[0]).seconds} seconds."
        )
    
    # Add current request
    requests.append(now)

# In execution_router.py
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

**Why Both Layers**:
- **API Gateway**: Protects against total system overload (100 req/sec global)
- **Per-User**: Prevents single user from consuming all quota (10 req/min per user)

**Example Scenario**:
```
Without per-user limit:
  User A: 90 req/sec (blocks everyone)
  User B: 10 req/sec (throttled)
  
With per-user limit:
  User A: 10 req/min (isolated)
  User B: 10 req/min (protected)
```

**Deliverables**:
- [ ] API Gateway throttling configured (global)
- [ ] Per-user rate limiting implemented (BFF)
- [ ] Rate limiting tested (both layers)
- [ ] CloudWatch alarms set up
- [ ] Rate limit headers added to responses

---

### Day 4: BFF API Endpoints (Part 1)

**Tasks**:
1. Implement `GET /executions` with GSI filtering
2. Implement `POST /executions` with rate limiting
3. Implement `GET /executions/{id}` with user isolation
4. Write integration tests

**Files**:
- `bff/routes/execution_router.py`

**Deliverables**:
- [ ] Endpoints implemented
- [ ] Integration tests passing
- [ ] Postman collection created

---

### Day 5: BFF API Endpoints (Part 2)

**Tasks**:
1. Implement `GET /executions/{id}/logs` (CloudWatch)
2. Implement `GET /executions/{id}/approval`
3. Implement `POST /executions/{id}/approve`
4. Implement `POST /executions/{id}/reject`
5. Implement `GET /dashboard/stats`

**Files**:
- `bff/routes/execution_router.py`
- `bff/routes/dashboard_router.py` (new)

**Deliverables**:
- [ ] All endpoints implemented
- [ ] Integration tests passing
- [ ] API documentation updated

---

## Week 2: Dashboard UI Implementation

### Day 6: Execution List Page

**Tasks**:
1. Create `/executions` page
2. Implement execution list component
3. Add filtering (repo, status)
4. Add pagination
5. Connect to BFF API

**Files**:
- `dashboard/src/app/(main)/executions/page.tsx`
- `dashboard/src/components/executions/ExecutionList.tsx` (new)

**Deliverables**:
- [ ] Execution list page working
- [ ] Filtering working
- [ ] Pagination working

---

### Day 7: Execution Detail Page (Part 1)

**Tasks**:
1. Create `/executions/[id]` page
2. Implement execution header
3. Implement stage timeline
4. Connect to BFF API

**Files**:
- `dashboard/src/app/(main)/executions/[id]/page.tsx`
- `dashboard/src/components/executions/ExecutionHeader.tsx` (new)
- `dashboard/src/components/executions/StageTimeline.tsx` (new)

**Deliverables**:
- [ ] Execution detail page created
- [ ] Header showing execution info
- [ ] Timeline showing stage progress

---

### Day 8: Execution Detail Page (Part 2)

**Tasks**:
1. Mount LogConsole component
2. Mount ApprovalPanel component
3. Mount CitationPanel component
4. Implement recommended layout

**Files**:
- `dashboard/src/app/(main)/executions/[id]/page.tsx`
- Update existing components

**Deliverables**:
- [ ] LogConsole showing real logs
- [ ] ApprovalPanel working
- [ ] CitationPanel showing sources
- [ ] Layout matches design

---

### Day 9: Dashboard Page Updates

**Tasks**:
1. Update dashboard page to show execution stats
2. Add recent executions widget
3. Add pending approvals widget
4. Mount ExecutionOverlay component

**Files**:
- `dashboard/src/app/(main)/dashboard/page.tsx`

**Deliverables**:
- [ ] Dashboard showing real stats
- [ ] Recent executions visible
- [ ] Pending approvals highlighted
- [ ] Execution overlay working

---

### Day 10: Navigation & Polish

**Tasks**:
1. Add "Executions" link to navigation
2. Add execution count badge
3. Update hardcoded pages to "Coming Soon"
4. Add toast notifications

**Files**:
- `dashboard/src/components/layout/DashboardLayout.tsx`
- `dashboard/src/app/(main)/resources/page.tsx`
- `dashboard/src/app/(main)/compliance/page.tsx`
- `dashboard/src/app/(main)/costs/page.tsx`

**Deliverables**:
- [ ] Navigation updated
- [ ] Badges showing counts
- [ ] Placeholder pages updated
- [ ] Notifications working

---

## Week 3: Testing & Polish

### Day 11-12: Integration Testing

**Tasks**:
1. Test execution creation flow
2. Test approval workflow
3. Test log streaming
4. Test real-time updates
5. Test error handling
6. **Test concurrency scenarios** (optimistic locking)

**Test Scenarios**:
- Create execution → View in list → View details
- Execution requires approval → Approve → Continue
- Execution fails → View logs → Retry
- Multiple executions → Filter → View details
- **Concurrent approvals → Verify only one succeeds** (NEW)

**Concurrency Test** (Critical):
```python
import threading
import requests

def test_concurrent_approvals():
    """Test optimistic locking with concurrent approvals
    
    Expected: Only one approval succeeds, other gets version conflict
    """
    execution_id = "exec-test-001"
    
    # Two users try to approve simultaneously
    def approve_as_user(user_token):
        response = requests.post(
            f'/executions/{execution_id}/approve',
            headers={'Authorization': f'Bearer {user_token}'}
        )
        return response
    
    # Start two approval requests simultaneously
    thread1 = threading.Thread(target=lambda: approve_as_user('token_user1'))
    thread2 = threading.Thread(target=lambda: approve_as_user('token_user2'))
    
    thread1.start()
    thread2.start()
    
    thread1.join()
    thread2.join()
    
    # Verify: One succeeds (200), one fails (409 Conflict)
    # Check execution version incremented only once
    execution = requests.get(f'/executions/{execution_id}').json()
    assert execution['data']['execution']['version'] == 2  # Incremented once
    
    # Check only one approval record exists
    approval = requests.get(f'/executions/{execution_id}/approval').json()
    assert approval['data']['status'] == 'APPROVED'
```

**Why This Test Matters**:
- Verifies optimistic locking works
- Prevents duplicate approvals
- Prevents race conditions
- Critical for data integrity

**Implementation Check**:
```python
# In execution_repo.update_execution_status()
def update_execution_status(self, user_id: str, execution_id: str, status: str):
    """Update with optimistic locking"""
    # Get current version
    execution = self.get_execution(user_id, execution_id)
    current_version = execution.version
    
    # Update with version check
    try:
        self.table.update_item(
            Key={'user_id': user_id, 'execution_id': execution_id},
            UpdateExpression='SET #status = :s, version = :new_ver',
            ConditionExpression='version = :current_ver',  # Optimistic lock
            ExpressionAttributeValues={
                ':s': status,
                ':current_ver': current_version,
                ':new_ver': current_version + 1
            },
            ExpressionAttributeNames={'#status': 'status'}
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            raise HTTPException(409, "Execution was modified by another request")
        raise
```

**Deliverables**:
- [ ] All user flows tested
- [ ] Edge cases handled
- [ ] Error messages clear
- [ ] **Concurrency test passing** (optimistic locking verified)

---

### Day 13-14: Performance Testing

**Tasks**:
1. Test with 100+ executions
2. Test GSI query performance
3. Test polling performance
4. Optimize slow queries

**Metrics**:
- Page load time < 2s
- API response time < 200ms
- Polling overhead < 5% CPU

**Deliverables**:
- [ ] Performance benchmarks met
- [ ] No performance regressions
- [ ] Optimization applied

---

### Day 15: Documentation & Deployment

**Tasks**:
1. Update API documentation
2. Create user guide
3. Create deployment checklist
4. Deploy to production

**Deliverables**:
- [ ] API docs updated
- [ ] User guide created
- [ ] Deployment successful
- [ ] Production verified

---

## Success Criteria

### Week 1 Success

- [ ] All GSI indexes created and active
- [ ] Rate limiting configured and tested
- [ ] All BFF endpoints implemented
- [ ] Integration tests passing
- [ ] Security verified (user isolation)

### Week 2 Success

- [ ] Execution list page working
- [ ] Execution detail page working
- [ ] All components mounted
- [ ] Dashboard page updated
- [ ] Navigation updated

### Week 3 Success

- [ ] All user flows tested
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Production deployment successful

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| GSI creation fails | Retry with correct schema |
| Rate limiting too strict | Adjust limits based on usage |
| CloudWatch logs slow | Add caching layer |
| Polling overhead high | Optimize polling interval |

### Timeline Risks

| Risk | Mitigation |
|------|------------|
| Week 1 delays | Prioritize critical fixes |
| Week 2 delays | Reduce UI polish |
| Week 3 delays | Deploy with known issues |

---

## Dependencies

### External Dependencies

- [ ] AWS account with DynamoDB access
- [ ] AWS account with API Gateway access
- [ ] GitHub OAuth app configured
- [ ] Bedrock access (optional for MVP)

### Internal Dependencies

- [ ] BFF deployed and accessible
- [ ] Orchestrator deployed and accessible
- [ ] DynamoDB tables created
- [ ] SQS queue created

---

## Rollback Plan

### If Critical Issues Found

**Week 1**: Rollback GSI changes
```bash
aws dynamodb update-table \
  --table-name ExecutionRecords \
  --global-secondary-index-updates \
    '[{"Delete":{"IndexName":"UserRepoIndex"}}]'
```

**Week 2**: Revert to hardcoded dashboard
```bash
git revert <commit-hash>
git push origin main
```

**Week 3**: Rollback deployment
```bash
aws lambda update-function-code \
  --function-name nexusops-bff \
  --zip-file fileb://previous-version.zip
```

---

## Monitoring

### Key Metrics to Track

**Week 1**:
- DynamoDB query latency (target: <100ms)
- API Gateway throttle count (should be low)
- Lambda error rate (target: <1%)
- **Per-user rate limit violations** (monitor abuse)

**Week 2**:
- Page load time (target: <2s)
- API response time (target: <200ms)
- User engagement (executions created)
- **Plan rejected rate** (AI quality metric)

**Week 3**:
- Execution creation rate (executions/hour)
- Approval workflow latency (time to approve)
- System uptime (target: 99.9%)
- **Plan rejected rate trend** (should be stable or decreasing)

**Critical AI Metric: plan_rejected_rate**

**Why Monitor This**:
- Measures AI reasoning quality
- Detects model degradation
- Identifies problematic patterns
- Enables continuous improvement

**CloudWatch Metric**:
```python
# In orchestrator VERIFY stage
if verification_failed:
    cloudwatch.put_metric_data(
        Namespace='NexusOPS',
        MetricData=[{
            'MetricName': 'PlanRejectedRate',
            'Value': 1,
            'Unit': 'Count',
            'Dimensions': [
                {'Name': 'Stage', 'Value': 'VERIFY'},
                {'Name': 'FailureReason', 'Value': failure_reason}
            ]
        }]
    )
```

**CloudWatch Alarm**:
```bash
# Alert if plan rejection rate exceeds 20%
aws cloudwatch put-metric-alarm \
  --alarm-name nexusops-high-plan-rejection-rate \
  --alarm-description "Alert when plan rejection rate exceeds 20%" \
  --metric-name PlanRejectedRate \
  --namespace NexusOPS \
  --statistic Average \
  --period 3600 \
  --evaluation-periods 2 \
  --threshold 0.20 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Stage,Value=VERIFY
```

**Dashboard Widget**:
```typescript
// Show plan quality trend
<MetricChart
  title="Plan Quality (Last 7 Days)"
  metrics={[
    { name: 'Plan Success Rate', value: 1 - plan_rejected_rate },
    { name: 'Plan Rejection Rate', value: plan_rejected_rate }
  ]}
  threshold={0.20}  // Alert if rejection rate > 20%
/>
```

---

## Communication Plan

### Daily Standups

- What was completed yesterday
- What will be completed today
- Any blockers

### Weekly Reviews

- Week 1: Critical fixes review
- Week 2: Dashboard UI review
- Week 3: Production readiness review

---

## Next Steps

1. **Review this roadmap** with team
2. **Confirm timeline** is realistic
3. **Assign tasks** to team members
4. **Start Day 1** (DynamoDB GSI indexes)

---

## Critical Implementation Notes

### 1. Rate Limiting: Dual-Layer Protection ⚠️

**Must Implement Both**:
- API Gateway throttling (100 req/sec global)
- Per-user rate limiting (10 req/min per user)

**Why**: API Gateway alone is global - one user can block everyone

### 2. Concurrency Testing ⚠️

**Must Test**: Concurrent approvals with optimistic locking
- Two users approve simultaneously
- Only one succeeds (version conflict)
- Verifies data integrity

### 3. Plan Quality Monitoring ⚠️

**Must Monitor**: `plan_rejected_rate` in CloudWatch
- Critical AI quality metric
- Detects model degradation
- Enables continuous improvement

---

**Document Version**: 2.0  
**Last Updated**: 2026-03-06  
**Status**: Ready to Start 🚀

**Key Improvements**:
- Added dual-layer rate limiting (global + per-user)
- Added concurrency testing (optimistic locking)
- Added plan quality monitoring (AI metric)

