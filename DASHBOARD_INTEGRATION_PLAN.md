# Dashboard Integration Implementation Plan

**Date**: 2026-03-06  
**Phase**: 5 (Dashboard Integration)  
**Estimated Effort**: 2-3 weeks  
**Status**: Planning

---

## Current State Analysis

### Already Integrated ✅

**Repositories Page** (`/repositories`):
- Uses `useRepositories` hook
- Connects to BFF `/repos/` endpoint
- Real GitHub OAuth flow
- Repository connection working
- Status: PRODUCTION READY

**Dashboard Page** (`/dashboard`):
- Uses `useRepositories` hook
- Shows connected repositories
- Chat interface (simulated responses)
- Status: PARTIALLY INTEGRATED

**Execution Hooks**:
- `useCreateExecution` - Create execution
- `useExecutionState` - Poll execution state
- `useExecutionLogs` - Poll execution logs
- `useRiskDetails` - Fetch risk assessment
- Status: READY (waiting for execution UI)

### Needs Integration ❌

**Resources Page** (`/resources`):
- Currently: Hardcoded AWS resources array
- Needs: BFF API endpoint `/resources`
- Data source: DynamoDB or orchestrator analysis
- Status: MOCKED

**Compliance Page** (`/compliance`):
- Currently: Hardcoded policy violations array
- Needs: BFF API endpoint `/violations`
- Data source: Risk registry + execution results
- Status: MOCKED

**Costs Page** (`/costs`):
- Currently: Hardcoded cost anomalies array
- Needs: BFF API endpoint `/costs/anomalies`
- Data source: AWS Cost Explorer or analysis
- Status: MOCKED

**Execution Lifecycle UI**:
- Components built but not mounted:
  - `ApprovalPanel.tsx`
  - `LogConsole.tsx`
  - `CitationPanel.tsx`
  - `ExecutionOverlay.tsx`
- Needs: Execution page to mount components
- Status: ORPHANED

---

## Architecture Decision: What Data to Show?

### Problem

The hardcoded data (resources, violations, costs) represents **Track A** functionality that doesn't exist in the backend yet. We have two options:

**Option 1: Wait for Backend Implementation**
- Pros: Real data, accurate representation
- Cons: Blocks dashboard integration, 4-5 weeks delay
- Timeline: After GitHub mutations + log persistence

**Option 2: Create Mock API Endpoints**
- Pros: Unblocks dashboard integration, demonstrates UI
- Cons: Not real data, needs replacement later
- Timeline: 1 week

**Option 3: Show Execution-Derived Data Only**
- Pros: Real data from executions, no mocks needed
- Cons: Limited data until executions run
- Timeline: 1 week

### Recommendation: Option 3 (Execution-Derived Data)

**Rationale**:
1. NexusOPS is a **governed agent execution engine**, not an AWS monitoring tool
2. The core value is **execution orchestration**, not resource inventory
3. We can show real execution data immediately
4. Resources/violations/costs can be derived from execution results

**What to Show**:
- Execution history and status
- Execution logs and timeline
- Approval workflow status
- Risk assessments from executions
- Tool execution results
- Plan quality metrics

**What to Remove** (for now):
- Hardcoded AWS resources
- Hardcoded policy violations
- Hardcoded cost anomalies

**Future Enhancement**:
- Add resource discovery from execution results
- Add violation detection from constraint stage
- Add cost analysis from execution metadata

---

## Implementation Plan

### Phase 1: Create Execution Dashboard (Week 1)

#### 1.1 Create Execution List Page

**File**: `dashboard/src/app/(main)/executions/page.tsx`

**Features**:
- List all executions for connected repositories
- Filter by status, repository, date range
- Show execution timeline
- Click to view details

**API Endpoint**: `/executions` (BFF)

**Mock Data** (until backend ready):
```typescript
GET /executions
Response: {
  data: {
    executions: [
      {
        execution_id: "exec-001",
        repo_id: "repo-123",
        repo_name: "nexusops-agent",
        status: "COMPLETED",
        stage: "VERIFY",
        created_at: "2026-03-06T10:00:00Z",
        updated_at: "2026-03-06T10:15:00Z",
        duration_ms: 900000
      }
    ]
  }
}
```

#### 1.2 Create Execution Detail Page

**File**: `dashboard/src/app/(main)/executions/[id]/page.tsx`

**Features**:
- Execution timeline (7 stages)
- Current stage indicator
- Execution logs (real-time)
- Approval panel (if needed)
- Risk assessment
- Tool execution results

**Components to Mount**:
- `ApprovalPanel` - Show approval workflow
- `LogConsole` - Show execution logs
- `CitationPanel` - Show source citations
- `ExecutionOverlay` - Show execution status

**API Endpoints**:
- `/executions/{id}` - Get execution state
- `/executions/{id}/logs` - Get execution logs
- `/executions/{id}/risks` - Get risk assessment
- `/executions/{id}/approve` - Approve execution
- `/executions/{id}/reject` - Reject execution

#### 1.3 Update Dashboard Page

**File**: `dashboard/src/app/(main)/dashboard/page.tsx`

**Changes**:
- Remove hardcoded data placeholder
- Show recent executions
- Show execution statistics
- Link to executions page

**Metrics to Show**:
- Total executions (last 24h)
- Success rate
- Average duration
- Pending approvals

---

### Phase 2: Create BFF API Endpoints (Week 1-2)

#### 2.1 Execution Endpoints

**File**: `bff/routes/execution_router.py`

**Endpoints to Add**:

```python
@router.get("/executions")
async def list_executions(
    user_id: str = Depends(get_current_user),
    repo_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List executions for user's repositories
    
    CRITICAL: Uses GSI indexes for efficient filtering
    """
    # Filter by repo_id using GSI1
    if repo_id:
        executions = execution_repo.get_executions_by_repo(
            user_id=user_id,
            repo_id=repo_id,
            limit=limit
        )
    # Filter by status using GSI2
    elif status:
        executions = execution_repo.get_executions_by_status(
            user_id=user_id,
            status=status,
            limit=limit
        )
    # No filter - query base table
    else:
        executions = execution_repo.get_executions_by_user(
            user_id=user_id,
            limit=limit
        )
    
    return {
        "data": {
            "executions": executions
        },
        "meta": {
            "total": len(executions),
            "page": offset // limit + 1,
            "limit": limit
        }
    }

@router.post("/executions")
async def create_execution(
    request: ExecutionRequest,
    user_id: str = Depends(get_current_user)
):
    """Create new execution
    
    CRITICAL: Rate limited to 10 executions/minute per user
    """
    # Check rate limit (API Gateway or application-level)
    check_rate_limit(user_id, limit=10, window=60)
    
    # Validate repo belongs to user
    repo = repo_repo.get_repository(user_id, request.repo_id)
    if not repo:
        raise HTTPException(404, "Repository not found")
    
    # Create execution record
    execution_id = generate_execution_id()
    execution = ExecutionRecord(
        user_id=user_id,
        execution_id=execution_id,
        repo_id=request.repo_id,
        status=ExecutionStatus.RUNNING,
        stage="ASK",
        input={"query": request.query, "repo_url": repo.repo_url},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        version=1
    )
    
    execution_repo.create_execution(execution)
    
    # Send to SQS for orchestrator
    await orchestrator_client.submit_execution(execution_id)
    
    return {
        "data": {
            "execution_id": execution_id,
            "status": "RUNNING"
        }
    }

@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get execution details
    
    CRITICAL: Verifies user ownership to prevent ID guessing
    """
    # Get execution with user isolation
    execution = execution_repo.get_execution(user_id, execution_id)
    
    if not execution:
        raise HTTPException(404, "Execution not found")
    
    return {
        "data": {
            "execution": execution.model_dump()
        }
    }

@router.get("/executions/{execution_id}/logs")
async def get_execution_logs(
    execution_id: str,
    user_id: str = Depends(get_current_user),
    since: Optional[str] = None
):
    """Get execution logs
    
    MVP: Fetch from CloudWatch Logs
    Future: Query DynamoDB ExecutionLogs table
    """
    # Verify execution belongs to user
    execution = execution_repo.get_execution(execution_id)
    if not execution or execution.user_id != user_id:
        raise HTTPException(404, "Execution not found")
    
    # MVP: Fetch from CloudWatch Logs
    logs = await cloudwatch_client.get_logs(
        log_group="/aws/lambda/nexusops-orchestrator",
        filter_pattern=f'{{ $.execution_id = "{execution_id}" }}',
        since=since
    )
    
    return {
        "data": {
            "logs": logs
        }
    }

@router.get("/executions/{execution_id}/approval")
async def get_execution_approval(
    execution_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get approval status for execution"""
    # Verify execution belongs to user
    execution = execution_repo.get_execution(execution_id)
    if not execution or execution.user_id != user_id:
        raise HTTPException(404, "Execution not found")
    
    # Query ApprovalRecords
    approval = approval_repo.get_approval_by_execution(execution_id)
    
    if not approval:
        return {
            "data": {
                "status": "NOT_REQUIRED",
                "execution_id": execution_id
            }
        }
    
    return {
        "data": {
            "approval_id": approval.approval_id,
            "execution_id": execution_id,
            "status": approval.status,
            "risk_level": approval.risk_level,
            "requested_at": approval.requested_at.isoformat(),
            "approver": approval.approver,
            "approved_at": approval.approved_at.isoformat() if approval.approved_at else None,
            "comments": approval.comments
        }
    }

@router.get("/executions/{execution_id}/risks")
async def get_execution_risks(
    execution_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get risk assessment for execution"""
    # Verify execution belongs to user
    execution = execution_repo.get_execution(execution_id)
    if not execution or execution.user_id != user_id:
        raise HTTPException(404, "Execution not found")
    
    # Get risk assessment from execution result
    risks = execution.result.get("risks", []) if execution.result else []
    
    return {
        "data": {
            "risks": risks,
            "overall_risk_level": execution.result.get("risk_level", "LOW") if execution.result else "LOW",
            "requires_approval": execution.status == ExecutionStatus.APPROVAL_PENDING
        }
    }

@router.post("/executions/{execution_id}/approve")
async def approve_execution(
    execution_id: str,
    user_id: str = Depends(get_current_user),
    comments: Optional[str] = None
):
    """Approve execution plan"""
    # Verify execution belongs to user
    execution = execution_repo.get_execution(execution_id)
    if not execution or execution.user_id != user_id:
        raise HTTPException(404, "Execution not found")
    
    if execution.status != ExecutionStatus.APPROVAL_PENDING:
        raise HTTPException(400, "Execution not pending approval")
    
    # Update ApprovalRecords
    approval = approval_repo.get_approval_by_execution(execution_id)
    approval_repo.update_approval(
        approval.approval_id,
        status="APPROVED",
        approver=user_id,
        approved_at=datetime.utcnow(),
        comments=comments
    )
    
    # Trigger next stage (ACT)
    await orchestrator_client.resume_execution(execution_id, "APPROVED")
    
    return {
        "data": {
            "status": "APPROVED",
            "execution_id": execution_id
        }
    }

@router.post("/executions/{execution_id}/reject")
async def reject_execution(
    execution_id: str,
    user_id: str = Depends(get_current_user),
    reason: str
):
    """Reject execution plan"""
    # Verify execution belongs to user
    execution = execution_repo.get_execution(execution_id)
    if not execution or execution.user_id != user_id:
        raise HTTPException(404, "Execution not found")
    
    if execution.status != ExecutionStatus.APPROVAL_PENDING:
        raise HTTPException(400, "Execution not pending approval")
    
    # Update ApprovalRecords
    approval = approval_repo.get_approval_by_execution(execution_id)
    approval_repo.update_approval(
        approval.approval_id,
        status="REJECTED",
        approver=user_id,
        approved_at=datetime.utcnow(),
        comments=reason
    )
    
    # Mark execution as FAILED
    execution_repo.update_execution_status(
        user_id=user_id,
        execution_id=execution_id,
        status=ExecutionStatus.FAILED,
        result={"rejection_reason": reason}
    )
    
    return {
        "data": {
            "status": "REJECTED",
            "execution_id": execution_id
        }
    }
```

**Critical Implementation Notes**:

1. **DynamoDB Query Pattern**:
   ```python
   # CORRECT: Query with PK
   execution_repo.get_executions_by_user(user_id)
   
   # WRONG: Scan entire table
   table.scan()  # ❌ Will destroy performance
   ```

2. **Logs from CloudWatch** (MVP):
   - ExecutionLogs table not yet implemented
   - Fetch from CloudWatch Logs as temporary solution
   - Filter by execution_id
   - Migrate to DynamoDB in Phase 3

#### 2.2 Dashboard Statistics Endpoint

**File**: `bff/routes/dashboard_router.py` (new)

**Endpoint**:

```python
@router.get("/dashboard/stats")
async def get_dashboard_stats(
    user_id: str = Depends(get_current_user)
):
    """Get dashboard statistics"""
    # Query ExecutionRecords for last 24h with PK=user_id
    executions = execution_repo.get_executions_by_user(
        user_id=user_id,
        since=datetime.utcnow() - timedelta(days=1)
    )
    
    # Calculate metrics
    total = len(executions)
    successful = len([e for e in executions if e.status == "COMPLETED"])
    failed = len([e for e in executions if e.status == "FAILED"])
    pending_approvals = len([e for e in executions if e.status == "APPROVAL_PENDING"])
    
    # Calculate plan correction rate (CRITICAL METRIC)
    verify_failures = len([e for e in executions if e.stage == "VERIFY" and e.result.get("verification_failed")])
    plan_rejected_rate = verify_failures / total if total > 0 else 0
    
    # Calculate average duration
    completed = [e for e in executions if e.status == "COMPLETED"]
    avg_duration = sum([e.duration_ms for e in completed]) / len(completed) if completed else 0
    
    # Group by stage
    executions_by_stage = {}
    for stage in ["ASK", "RETRIEVE", "REASON", "CONSTRAINT", "APPROVAL_PENDING", "ACT", "VERIFY"]:
        executions_by_stage[stage] = len([e for e in executions if e.stage == stage])
    
    return {
        "data": {
            "total_executions": total,
            "success_rate": successful / total if total > 0 else 0,
            "failure_rate": failed / total if total > 0 else 0,
            "avg_duration_ms": avg_duration,
            "pending_approvals": pending_approvals,
            "plan_rejected_rate": plan_rejected_rate,  # AI quality metric
            "executions_by_stage": executions_by_stage
        },
        "meta": {
            "period": "24h",
            "timestamp": datetime.utcnow().isoformat()
        }
    }
```

**Critical Metrics Added**:
- `plan_rejected_rate` - How often VERIFY stage rejects plans (AI quality indicator)
- `failure_rate` - Overall execution failure rate
- Proper response format with `data` and `meta` sections

---

### Phase 3: Update Navigation (Week 2)

#### 3.1 Add Executions Link

**File**: `dashboard/src/components/layout/DashboardLayout.tsx`

**Changes**:
- Add "Executions" link to sidebar
- Update active state logic
- Add execution count badge (if pending approvals)

#### 3.2 Remove Hardcoded Pages (Optional)

**Decision**: Keep or remove?

**Option A: Remove Completely**
- Delete `/resources`, `/compliance`, `/costs` pages
- Remove from navigation
- Clean, focused on execution engine

**Option B: Show "Coming Soon"**
- Keep pages but show placeholder
- "This data will be available after execution analysis"
- Maintains navigation structure

**Option C: Derive from Executions**
- Show resources discovered during RETRIEVE stage
- Show violations found during CONSTRAINT stage
- Show cost estimates from execution metadata

**Recommendation**: Option B (Coming Soon) for now, Option C later

---

### Phase 4: Mount Execution UI Components (Week 2)

#### 4.1 Approval Panel Integration

**File**: `dashboard/src/app/(main)/executions/[id]/page.tsx`

**Recommended Layout**:
```
-------------------------------------------------
 Execution Header
 Repo | Status | Duration | Created
-------------------------------------------------
 Stage Timeline
 ASK → RETRIEVE → REASON → CONSTRAINT → ACT → VERIFY
-------------------------------------------------
 LEFT PANEL               RIGHT PANEL
-------------------------------------------------
 LogConsole               Risk Panel
                          ApprovalPanel
-------------------------------------------------
 CitationPanel
-------------------------------------------------
```

**Usage**:
```typescript
import { ApprovalPanel } from "@/components/dashboard/ApprovalPanel";

// In execution detail page
{execution.status === "APPROVAL_PENDING" && (
  <ApprovalPanel
    executionId={execution.execution_id}
    risks={risks}
    onApprove={handleApprove}
    onReject={handleReject}
  />
)}
```

**Layout Benefits**:
- Stage timeline shows execution progress
- LogConsole on left for detailed logs
- Risk/Approval panels on right for decision-making
- Citations at bottom for source references
- Visually clear and organized

#### 4.2 Log Console Integration

**File**: `dashboard/src/app/(main)/executions/[id]/page.tsx`

**Usage**:
```typescript
import { LogConsole } from "@/components/dashboard/LogConsole";

// In execution detail page
<LogConsole
  executionId={execution.execution_id}
  logs={logs}
  isLoading={isLoadingLogs}
/>
```

#### 4.3 Citation Panel Integration

**File**: `dashboard/src/app/(main)/executions/[id]/page.tsx`

**Usage**:
```typescript
import { CitationPanel } from "@/components/dashboard/CitationPanel";

// In execution detail page
{execution.stage === "RETRIEVE" && (
  <CitationPanel
    sources={execution.sources}
  />
)}
```

#### 4.4 Execution Overlay Integration

**File**: `dashboard/src/app/(main)/dashboard/page.tsx`

**Usage**:
```typescript
import { ExecutionOverlay } from "@/components/execution/ExecutionOverlay";

// Show overlay when execution is running
{activeExecution && (
  <ExecutionOverlay
    executionId={activeExecution.execution_id}
    onClose={() => setActiveExecution(null)}
  />
)}
```

---

### Phase 5: Real-Time Updates (Week 3)

#### 5.1 WebSocket Integration (Optional)

**Alternative**: Polling (already implemented in hooks)

**If WebSocket Needed**:
- Add WebSocket endpoint to BFF
- Update `useExecutionState` to use WebSocket
- Update `useExecutionLogs` to use WebSocket

**Current Approach**: Polling every 2 seconds (sufficient for MVP)

#### 5.2 Notification System

**Features**:
- Toast notifications for execution events
- Browser notifications (with permission)
- Email notifications (via SNS)

**Implementation**:
```typescript
// In execution detail page
useEffect(() => {
  if (prevStatus !== execution.status) {
    toast.success(`Execution ${execution.status}`);
    
    if (execution.status === "APPROVAL_PENDING") {
      showNotification("Approval Required", {
        body: `Execution ${execution.execution_id} requires approval`
      });
    }
  }
}, [execution.status]);
```

---

## Architecture Insights

### Product Positioning

**NexusOPS is NOT**:
- AWS monitoring dashboard
- Infrastructure inventory tool
- Cost management platform

**NexusOPS IS**:
- Agent execution orchestration platform
- Governed AI workflow engine
- Code automation platform

**Dashboard Focus**: Execution-centric, not infrastructure-centric

### Industry Comparisons

**Similar UX Patterns**:

| Product | Equivalent Page | NexusOPS Page |
|---------|----------------|---------------|
| GitHub Actions | Workflow runs | /executions |
| Vercel | Deployments | /executions |
| Temporal | Workflow executions | /executions |
| Prefect | Flow runs | /executions |
| LangSmith | Run history | /executions |

**Key Insight**: All modern agent/workflow platforms use execution history as primary UI

### Future: Execution-Derived Resources

**Phase 1** (Current): Show executions only

**Phase 2** (Future): Derive insights from executions

**Example**:
```
RETRIEVE stage discovers:
  - 22 files analyzed
  - 3 services identified
  - 2 dependencies found

Dashboard can show:
  - Resources discovered
  - Violations detected
  - Estimated changes
```

**Benefits**:
- Agent-centric data model
- Real insights from actual analysis
- No hardcoded mock data
- Aligns with product vision

---

## Implementation Checklist

### Week 1: Core Execution UI

- [ ] **Add GSI indexes to ExecutionRecords table** ⚠️ CRITICAL
  - [ ] GSI1: UserRepoIndex (PK=user_id, SK=repo_id)
  - [ ] GSI2: UserStatusIndex (PK=user_id, SK=status)
- [ ] **Implement rate limiting** (API Gateway throttling: 10 req/min)
- [ ] **Update execution repository** with user isolation methods:
  - [ ] `get_execution(user_id, execution_id)` - User isolation
  - [ ] `get_executions_by_repo(user_id, repo_id)` - Uses GSI1
  - [ ] `get_executions_by_status(user_id, status)` - Uses GSI2
- [ ] Create `/executions` page (list view)
- [ ] Create `/executions/[id]` page (detail view)
- [ ] Add BFF endpoint `GET /executions` (with GSI filtering)
- [ ] Add BFF endpoint `POST /executions` (with rate limiting)
- [ ] Add BFF endpoint `GET /executions/{id}` (with user isolation)
- [ ] Add BFF endpoint `GET /executions/{id}/logs` (from CloudWatch)
- [ ] Add BFF endpoint `GET /executions/{id}/risks`
- [ ] Add BFF endpoint `GET /executions/{id}/approval`
- [ ] Update dashboard page to show execution stats
- [ ] Add "Executions" link to navigation

### Week 2: Approval Workflow & Components

- [ ] Add BFF endpoint `POST /executions/{id}/approve`
- [ ] Add BFF endpoint `POST /executions/{id}/reject`
- [ ] Add BFF endpoint `GET /dashboard/stats` (with plan_rejected_rate metric)
- [ ] Implement recommended execution detail layout (stage timeline + panels)
- [ ] Mount `ApprovalPanel` in execution detail
- [ ] Mount `LogConsole` in execution detail
- [ ] Mount `CitationPanel` in execution detail
- [ ] Mount `ExecutionOverlay` in dashboard
- [ ] Update hardcoded pages to "Coming Soon" placeholders
- [ ] Add execution count badge to navigation (if pending approvals)

### Week 3: Polish & Real-Time

- [ ] Add execution timeline visualization
- [ ] Add stage progress indicators
- [ ] Add execution filtering and search
- [ ] Add toast notifications
- [ ] Add browser notifications
- [ ] Test approval workflow end-to-end
- [ ] Test execution lifecycle UI
- [ ] Performance optimization

---

## API Contract

### Execution List Response

```typescript
{
  data: {
    executions: [
      {
        execution_id: string,
        user_id: string,
        repo_id: string,
        repo_name: string,
        status: "RUNNING" | "COMPLETED" | "FAILED" | "APPROVAL_PENDING",
        stage: "ASK" | "RETRIEVE" | "REASON" | "CONSTRAINT" | "ACT" | "VERIFY",
        created_at: string,
        updated_at: string,
        duration_ms: number,
        version: number
      }
    ]
  },
  meta: {
    total: number,
    page: number,
    limit: number
  }
}
```

**Note**: Response format uses `data` and `meta` sections for cleaner pagination

### Execution Detail Response

```typescript
{
  data: {
    execution: {
      execution_id: string,
      user_id: string,
      repo_id: string,
      repo_name: string,
      status: string,
      stage: string,
      input: {
        query: string,
        repo_url: string
      },
      result: {
        plan: object,
        actions: array,
        verification: object
      },
      created_at: string,
      updated_at: string,
      duration_ms: number,
      version: number
    }
  }
}
```

### Execution Logs Response

```typescript
{
  data: {
    logs: [
      {
        id: string,
        execution_id: string,
        timestamp: string,
        stage: string,
        event: string,
        message: string,
        latency_ms: number,
        metadata: object
      }
    ]
  }
}
```

**MVP Implementation**: Logs fetched from CloudWatch Logs, not DynamoDB ExecutionLogs table

### Risk Assessment Response

```typescript
{
  data: {
    risks: [
      {
        risk_id: string,
        name: string,
        description: string,
        severity: "LOW" | "MEDIUM" | "HIGH",
        matched_rules: array,
        mitigation: string
      }
    ],
    overall_risk_level: "LOW" | "MEDIUM" | "HIGH",
    requires_approval: boolean
  }
}
```

### Approval Status Response

```typescript
{
  data: {
    approval_id: string,
    execution_id: string,
    status: "PENDING" | "APPROVED" | "REJECTED" | "NOT_REQUIRED",
    risk_level: "LOW" | "MEDIUM" | "HIGH",
    requested_at: string,
    approver: string | null,
    approved_at: string | null,
    comments: string | null
  }
}
```

**New Endpoint**: `GET /executions/{id}/approval` - Required for UI to fetch approval status

---

## Testing Strategy

### Unit Tests

- [ ] Test execution list API endpoint
- [ ] Test execution detail API endpoint
- [ ] Test approval/reject endpoints
- [ ] Test dashboard stats calculation
- [ ] Test execution hooks

### Integration Tests

- [ ] Test execution creation flow
- [ ] Test approval workflow
- [ ] Test log streaming
- [ ] Test real-time updates
- [ ] Test error handling

### End-to-End Tests

- [ ] Create execution → View in dashboard
- [ ] Execution requires approval → Approve → Continue
- [ ] Execution fails → View logs → Retry
- [ ] Multiple executions → Filter → View details

---

## Migration Strategy

### Removing Hardcoded Data

**Step 1**: Add "Coming Soon" placeholders
```typescript
// In resources/page.tsx
export default function ResourcesPage() {
  return (
    <PageContainer heading="Resource Inventory">
      <div className="card p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
        <p className="text-sm text-textMuted">
          Resource inventory will be populated from execution analysis results.
        </p>
      </div>
    </PageContainer>
  );
}
```

**Step 2**: Derive from executions (future)
```typescript
// Query executions for RETRIEVE stage results
const resources = executions
  .filter(e => e.stage === "RETRIEVE")
  .flatMap(e => e.result.discovered_resources);
```

---

## Success Criteria

### Phase 1 Success

- [ ] Execution list page shows real data from DynamoDB
- [ ] Execution detail page shows execution state
- [ ] Dashboard shows execution statistics
- [ ] Navigation includes Executions link

### Phase 2 Success

- [ ] Approval workflow functional end-to-end
- [ ] All orphaned components mounted and working
- [ ] Logs display in real-time
- [ ] Risk assessment visible

### Phase 3 Success

- [ ] Real-time updates working (polling or WebSocket)
- [ ] Notifications working
- [ ] Hardcoded pages replaced or marked "Coming Soon"
- [ ] End-to-end execution flow tested

---

## Timeline

**Week 1**: Core execution UI + BFF endpoints  
**Week 2**: Approval workflow + component integration  
**Week 3**: Polish + real-time updates + testing

**Total**: 2-3 weeks

---

## Dependencies

**Requires**:
- DynamoDB ExecutionRecords table (✅ exists)
- DynamoDB ApprovalRecords table (✅ exists)
- DynamoDB RiskRegistry table (✅ exists)
- BFF authentication (✅ exists)
- Repository connection (✅ exists)

**Optional**:
- DynamoDB ExecutionLogs table (⚠️ in-memory, Phase 3)
- WebSocket support (⚠️ polling sufficient for MVP)

---

## Critical Implementation Notes

### Critical Implementation Notes

### 1. DynamoDB GSI Indexes ⚠️ CRITICAL

**Problem**: Filtering by `repo_id` or `status` requires scanning all user executions

**Current Schema**:
```
ExecutionRecords:
  PK: user_id
  SK: execution_id
```

**Issue**: Filters like `repo_id=repo-123` or `status=COMPLETED` use filter expressions, which still read all items

**Solution**: Add GSI indexes

**Required GSIs**:
```bash
# GSI1: Filter by repository
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

# GSI2: Filter by status
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
# Filter by repo_id
if repo_id:
    response = table.query(
        IndexName='UserRepoIndex',
        KeyConditionExpression='user_id = :uid AND repo_id = :rid',
        ExpressionAttributeValues={':uid': user_id, ':rid': repo_id}
    )

# Filter by status
elif status:
    response = table.query(
        IndexName='UserStatusIndex',
        KeyConditionExpression='user_id = :uid AND #status = :s',
        ExpressionAttributeValues={':uid': user_id, ':s': status},
        ExpressionAttributeNames={'#status': 'status'}  # 'status' is reserved word
    )

# No filter - query base table
else:
    response = table.query(
        KeyConditionExpression='user_id = :uid',
        ExpressionAttributeValues={':uid': user_id}
    )
```

**Impact**: Without GSIs, dashboard will become slow as executions grow

**Priority**: HIGH - Add to infrastructure setup

---

### 2. Security: User Isolation ⚠️ CRITICAL

**Problem**: Current implementation allows execution ID guessing

**Vulnerable Code**:
```python
# ❌ WRONG - Anyone can guess execution IDs
execution = execution_repo.get_execution(execution_id)
```

**Attack Scenario**:
```
User A creates: exec-001
User B guesses: exec-001
User B can view User A's execution
```

**Solution**: Always verify user ownership

**Correct Implementation**:
```python
# ✅ CORRECT - Requires both user_id and execution_id
execution = execution_repo.get_execution(user_id, execution_id)

# Or verify ownership after fetch
execution = execution_repo.get_execution(execution_id)
if execution.user_id != user_id:
    raise HTTPException(403, "Access denied")
```

**Updated Repository Method**:
```python
class ExecutionRepository:
    def get_execution(self, user_id: str, execution_id: str):
        """Get execution with user isolation"""
        response = self.table.get_item(
            Key={'user_id': user_id, 'execution_id': execution_id}
        )
        item = response.get('Item')
        if not item:
            return None
        return ExecutionRecord(**item)
```

**Impact**: Prevents unauthorized access to executions

**Priority**: CRITICAL - Security vulnerability

---

### 3. Rate Limiting ⚠️ CRITICAL

**Problem**: No rate limiting on `POST /executions`

**Attack Scenario**:
```python
# Malicious user triggers 1000 executions
for i in range(1000):
    requests.post('/executions', json={'repo_id': 'repo-123', 'query': 'spam'})

# Result: Lambda + SQS costs explode
```

**Solution**: Implement rate limiting

**Option 1: API Gateway Throttling** (Recommended for MVP)
```bash
aws apigateway update-stage \
  --rest-api-id YOUR_API_ID \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/throttle/rateLimit,value=10 \
    op=replace,path=/throttle/burstLimit,value=20
```

**Option 2: Application-Level Rate Limiting**
```python
from fastapi import HTTPException
from datetime import datetime, timedelta
import redis

redis_client = redis.Redis(host='localhost', port=6379)

def check_rate_limit(user_id: str, limit: int = 10, window: int = 60):
    """Check if user exceeded rate limit"""
    key = f"rate_limit:executions:{user_id}"
    current = redis_client.get(key)
    
    if current and int(current) >= limit:
        raise HTTPException(429, "Rate limit exceeded. Max 10 executions per minute.")
    
    # Increment counter
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    pipe.execute()

@router.post("/executions")
async def create_execution(
    request: ExecutionRequest,
    user_id: str = Depends(get_current_user)
):
    # Check rate limit
    check_rate_limit(user_id, limit=10, window=60)
    
    # Create execution
    ...
```

**Option 3: DynamoDB Counter** (No external dependencies)
```python
def check_rate_limit_dynamodb(user_id: str, limit: int = 10):
    """Check rate limit using DynamoDB"""
    table = get_table('RateLimits')
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=1)
    
    # Query recent executions
    response = table.query(
        KeyConditionExpression='user_id = :uid AND created_at > :start',
        ExpressionAttributeValues={
            ':uid': user_id,
            ':start': window_start.isoformat()
        }
    )
    
    if len(response['Items']) >= limit:
        raise HTTPException(429, "Rate limit exceeded. Max 10 executions per minute.")
```

**Recommended**: API Gateway throttling (simplest, no code changes)

**Limits**:
- Rate: 10 requests/minute per user
- Burst: 20 requests (allows short spikes)

**Priority**: HIGH - Prevents cost explosion

---

### 4. DynamoDB Query Pattern ⚠️ CRITICAL

**CORRECT**:
```python
# Query with partition key
execution_repo.get_executions_by_user(user_id=user_id)
```

**WRONG**:
```python
# Scan entire table - will destroy performance
table.scan()  # ❌ NEVER DO THIS
```

**Why**: DynamoDB requires partition key (PK) for efficient queries. Scanning without PK is expensive and slow.

---

### 2. Missing Endpoints ⚠️ CRITICAL

**Must Add**:
1. `POST /executions` - Create new execution (dashboard is read-only without this)
2. `GET /executions/{id}/approval` - Fetch approval status (UI needs this for approval panel)

**Without These**: Dashboard cannot trigger executions or show approval details

---

### 3. Logs from CloudWatch (MVP)

**Current State**: ExecutionLogs table not implemented (in-memory only)

**MVP Solution**: Fetch logs from CloudWatch Logs
```python
cloudwatch_client.get_logs(
    log_group="/aws/lambda/nexusops-orchestrator",
    filter_pattern=f'{{ $.execution_id = "{execution_id}" }}'
)
```

**Future**: Migrate to DynamoDB ExecutionLogs table (Phase 3)

---

### 4. Plan Quality Metrics ⚠️ IMPORTANT

**Critical Metric**: `plan_rejected_rate`

**Why**: Measures AI reasoning quality
- High rejection rate = AI planner degrading
- Low rejection rate = AI planner improving
- Without this metric, system is a black box

**Implementation**:
```python
verify_failures = len([e for e in executions if e.stage == "VERIFY" and e.result.get("verification_failed")])
plan_rejected_rate = verify_failures / total if total > 0 else 0
```

---

### 5. API Response Format

**Use**:
```typescript
{
  data: { ... },
  meta: { total, page, limit }
}
```

**Not**:
```typescript
{
  success: true,
  data: { ... }
}
```

**Why**: Cleaner pagination, industry standard

---

### 6. Polling Strategy (MVP)

**Current**: Poll every 2 seconds with ETag/updated_at

**Why Polling**:
- Simple to implement
- Reliable
- No WebSocket complexity
- Sufficient for MVP

**Future**: Can migrate to WebSockets if needed

---

### 7. Navigation Strategy

**Decision**: Keep hardcoded pages with "Coming Soon" placeholders

**Why**:
- Maintains navigation stability
- Shows product roadmap
- Better UX than removing pages

**Example**:
```typescript
<div className="card p-12 text-center">
  <h3>Coming Soon</h3>
  <p>Resource inventory will be populated from execution analysis</p>
</div>
```

---

### 8. Execution Detail Layout

**Recommended Structure**:
```
┌─────────────────────────────────────────────────┐
│ Execution Header                                │
│ Repo | Status | Duration | Created             │
├─────────────────────────────────────────────────┤
│ Stage Timeline                                  │
│ ASK → RETRIEVE → REASON → CONSTRAINT → ACT → VERIFY │
├──────────────────────┬──────────────────────────┤
│ LEFT PANEL           │ RIGHT PANEL              │
│                      │                          │
│ LogConsole           │ Risk Panel               │
│                      │ ApprovalPanel            │
├──────────────────────┴──────────────────────────┤
│ CitationPanel                                   │
└─────────────────────────────────────────────────┘
```

**Why**: Visually clear, matches industry patterns (GitHub Actions, Temporal)

---

### 9. Lambda Timeout Risk

**Current**: Single Lambda invocation (up to 15 minutes)

**Risk**: Long executions (>15 min) will fail

**Future Solution**: Migrate to AWS Step Functions

**For Now**: Lambda is fine for MVP

---

### 10. Execution-Derived Resources (Future)

**Vision**: Derive dashboard data from execution results

**Example**:
```
RETRIEVE stage discovers:
  - 22 files
  - 3 services
  - 2 dependencies

Dashboard shows:
  - Resources discovered
  - Violations detected
  - Estimated changes
```

**Why**: Agent-centric data model, aligns with product vision

---

## Next Steps

1. **Start with Week 1 tasks** (execution list + detail pages)
2. **Implement critical missing endpoints**:
   - `POST /executions` (create execution)
   - `GET /executions/{id}/approval` (approval status)
3. **Use DynamoDB Query with PK=user_id** (NOT Scan)
4. **Fetch logs from CloudWatch** (MVP solution until ExecutionLogs table)
5. **Add plan_rejected_rate metric** (AI quality indicator)
6. **Implement recommended execution detail layout** (stage timeline + panels)
7. **Mount orphaned components** in execution detail page
8. **Test approval workflow** end-to-end
9. **Replace hardcoded data** with "Coming Soon" placeholders
10. **Follow API response format** with `data` and `meta` sections

---

**Document Version**: 2.0  
**Last Updated**: 2026-03-06  
**Status**: Ready for Implementation (with technical review improvements)

**Key Improvements from Technical Review**:
- Added missing `POST /executions` endpoint
- Added missing `GET /executions/{id}/approval` endpoint
- Emphasized DynamoDB Query pattern (avoid Scan)
- Added CloudWatch Logs solution for MVP
- Added plan quality metrics (plan_rejected_rate)
- Improved API response format (data + meta)
- Added recommended execution detail layout
- Clarified product positioning (agent platform, not AWS monitoring)
- Added industry comparisons (GitHub Actions, Temporal, etc.)
- Added execution-derived resources vision
