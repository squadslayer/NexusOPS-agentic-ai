# Architecture Decision: Agent Execution Model

**Date**: 2026-03-06  
**Status**: Decision Required  
**Impact**: Critical - affects reliability, cost, complexity, observability

---

## Strategic Question

Should NexusOPS run the agent loop in:

**Option A**: Single Lambda Invocation  
**Option B**: Distributed Step-Based Workflow

This decision fundamentally changes the system's characteristics.

---

## Option A: Single Lambda Invocation

### Architecture

```
User Request
  ↓
SQS Queue
  ↓
Single Lambda Invocation (up to 15 minutes)
  ↓
  ASK → RETRIEVE → REASON → CONSTRAINT → ACT → VERIFY
  ↓
Complete Execution
```

### Characteristics

**Execution Model**:
- All stages run in one Lambda invocation
- State persisted only at start and end
- Logs stored in-memory during execution
- Single transaction boundary

**Code Structure**:
```typescript
async function handleExecution(executionId: string) {
  // All stages in one function
  await askStage(executionId);
  await retrieveStage(executionId);
  await reasonStage(executionId);
  await constraintStage(executionId);
  
  if (requiresApproval) {
    await waitForApproval(executionId);  // Polling or callback
  }
  
  await actStage(executionId);
  await verifyStage(executionId);
  
  return result;
}
```

### Advantages ✅

1. **Simplicity**
   - Single code path
   - No distributed state management
   - Easier to debug
   - Fewer moving parts

2. **Performance**
   - No inter-Lambda latency
   - No SQS message overhead
   - Faster execution (no cold starts between stages)
   - Lower cost (single Lambda invocation)

3. **Consistency**
   - Single transaction boundary
   - No partial execution states
   - Easier rollback
   - Atomic execution

4. **Development Speed**
   - Faster to implement
   - Easier to test locally
   - Simpler error handling
   - Less infrastructure

### Disadvantages ❌

1. **Timeout Risk**
   - 15-minute Lambda limit
   - Long-running executions fail
   - Cannot handle complex retrievals
   - Bedrock latency unpredictable

2. **Resource Waste**
   - Lambda runs during approval wait
   - Idle time costs money
   - Cannot scale stages independently
   - Memory allocated for entire duration

3. **Limited Observability**
   - Logs only at end (unless streamed)
   - Cannot inspect mid-execution state
   - Harder to debug failures
   - No stage-level metrics

4. **Approval Workflow Issues**
   - Lambda must poll for approval
   - Wastes compute during wait
   - Timeout if approval takes too long
   - Cannot pause/resume cleanly

5. **Scalability Limits**
   - Cannot parallelize stages
   - Cannot prioritize stages differently
   - All stages share same resources
   - Bottlenecks affect entire execution

### When to Use

**Good for**:
- Fast executions (<5 minutes)
- Simple workflows
- Prototyping and MVP
- Low-volume systems
- Predictable execution times

**Bad for**:
- Long-running executions
- Approval workflows with human latency
- High-volume systems
- Complex multi-step processes
- Production systems requiring observability

---

## Option B: Distributed Step-Based Workflow

### Architecture

```
User Request
  ↓
SQS Queue
  ↓
Lambda 1: ASK
  ↓ (persist state)
Lambda 2: RETRIEVE
  ↓ (persist state)
Lambda 3: REASON
  ↓ (persist state)
Lambda 4: CONSTRAINT
  ↓ (persist state)
[Wait for Approval if needed]
  ↓
Lambda 5: ACT
  ↓ (persist state)
Lambda 6: VERIFY
  ↓
Complete Execution
```

### Characteristics

**Execution Model**:
- Each stage is a separate Lambda invocation
- State persisted after every stage
- Logs persisted to DynamoDB
- Multiple transaction boundaries

**Code Structure**:
```typescript
// Stage orchestrator
async function handleStage(executionId: string, stage: Stage) {
  const execution = await loadExecution(executionId);
  
  switch (stage) {
    case 'ASK':
      await askStage(execution);
      await transitionTo(executionId, 'RETRIEVE');
      break;
    case 'RETRIEVE':
      await retrieveStage(execution);
      await transitionTo(executionId, 'REASON');
      break;
    // ... other stages
  }
}

// State transition triggers next Lambda
async function transitionTo(executionId: string, nextStage: Stage) {
  await updateExecutionState(executionId, nextStage);
  await invokeLambda({ executionId, stage: nextStage });
}
```

### Advantages ✅

1. **No Timeout Limits**
   - Each stage has 15 minutes
   - Total execution can be hours/days
   - Approval workflow can wait indefinitely
   - Handles complex retrievals

2. **Better Resource Utilization**
   - No idle Lambda during approval
   - Pay only for active compute
   - Can scale stages independently
   - Right-size memory per stage

3. **Superior Observability**
   - State visible after each stage
   - Can inspect mid-execution
   - Stage-level metrics
   - Easier debugging

4. **Fault Tolerance**
   - Retry individual stages
   - No need to restart entire execution
   - Partial execution recovery
   - Idempotent stage execution

5. **Scalability**
   - Stages can run in parallel (if independent)
   - Different concurrency limits per stage
   - Can prioritize critical stages
   - Horizontal scaling per stage

6. **Approval Workflow**
   - Lambda completes during approval wait
   - No compute waste
   - Can wait indefinitely
   - Clean pause/resume

### Disadvantages ❌

1. **Complexity**
   - Distributed state management
   - More code to maintain
   - Harder to debug
   - More infrastructure

2. **Latency**
   - Inter-Lambda invocation overhead
   - Cold start between stages
   - SQS message latency
   - DynamoDB read/write latency

3. **Cost (for fast executions)**
   - Multiple Lambda invocations
   - More DynamoDB operations
   - More SQS messages
   - Higher cost for simple executions

4. **Consistency Challenges**
   - Partial execution states
   - Race conditions possible
   - Requires idempotency
   - Complex error handling

5. **Development Overhead**
   - More code to write
   - More tests needed
   - Harder to test locally
   - Steeper learning curve

### When to Use

**Good for**:
- Long-running executions (>5 minutes)
- Approval workflows
- High-volume systems
- Production systems
- Complex multi-step processes
- Systems requiring observability

**Bad for**:
- Simple workflows
- Fast executions (<1 minute)
- Prototyping
- Low-volume systems
- Cost-sensitive applications

---

## Production Agent Systems: What They Choose

### Industry Standard: Distributed Step-Based

**Examples**:
- **AWS Step Functions** - Distributed state machine
- **Temporal** - Distributed workflow engine
- **Airflow** - Distributed task orchestration
- **Prefect** - Distributed workflow orchestration

**Why**:
1. Approval workflows require indefinite waits
2. Observability is critical for debugging
3. Fault tolerance is essential
4. Scalability matters at production scale
5. Timeout limits are unacceptable

### Hybrid Approach (Recommended)

**Fast Path** (Single Lambda):
```
Simple executions without approval
  ↓
Single Lambda (all stages)
  ↓
Complete in <5 minutes
```

**Slow Path** (Distributed):
```
Complex executions or approval required
  ↓
Distributed stages
  ↓
Can take hours/days
```

**Decision Logic**:
```typescript
async function routeExecution(request: ExecutionRequest) {
  const estimatedDuration = estimateExecutionTime(request);
  const requiresApproval = await assessRisk(request);
  
  if (estimatedDuration < 300 && !requiresApproval) {
    // Fast path: single Lambda
    return await executeSingleInvocation(request);
  } else {
    // Slow path: distributed
    return await executeDistributed(request);
  }
}
```

---

## Recommendation for NexusOPS

### Current State Analysis

**NexusOPS Requirements**:
- ✅ Approval workflow (requires indefinite wait)
- ✅ Complex retrievals (GitHub API, potentially slow)
- ✅ Bedrock reasoning (unpredictable latency)
- ✅ Production observability needed
- ✅ Fault tolerance important

**Current Implementation**:
- Appears to be single Lambda invocation
- State persisted to DynamoDB
- Logs in-memory (not persisted)
- Approval workflow exists but unclear how wait is handled

### Recommended Architecture: Distributed Step-Based

**Rationale**:

1. **Approval Workflow is Critical**
   - Human approval can take minutes to hours
   - Cannot keep Lambda running during wait
   - Distributed model is only viable option

2. **Observability is Essential**
   - Need to inspect execution state mid-flight
   - Need stage-level metrics
   - Need to debug failures at stage level

3. **Timeout Risk is Real**
   - GitHub retrieval can be slow (large repos)
   - Bedrock can be slow (complex reasoning)
   - 15-minute limit is too restrictive

4. **Production Requirements**
   - Fault tolerance needed
   - Scalability needed
   - Cost optimization needed (no idle Lambda)

### Implementation Plan

**Phase 1: Distributed Core** (Current)
```typescript
// Each stage is a separate handler
export async function handleAsk(event: StageEvent) {
  const execution = await loadExecution(event.executionId);
  await askStage(execution);
  await transitionTo(execution.execution_id, 'RETRIEVE');
}

export async function handleRetrieve(event: StageEvent) {
  const execution = await loadExecution(event.executionId);
  await retrieveStage(execution);
  await transitionTo(execution.execution_id, 'REASON');
}

// ... other stages
```

**Phase 2: Add Idempotency**
```typescript
// Idempotency key per stage
const idempotencyKey = `${executionId}:${stage}:${version}`;

// Check if stage already completed
const existing = await getStageResult(idempotencyKey);
if (existing) {
  return existing;  // Skip re-execution
}

// Execute stage
const result = await executeStage(execution, stage);

// Store result with idempotency key
await storeStageResult(idempotencyKey, result);
```

**Phase 3: Add Stage-Level Metrics**
```typescript
// Emit metrics per stage
await cloudwatch.putMetric({
  MetricName: 'StageLatency',
  Dimensions: [{ Name: 'Stage', Value: stage }],
  Value: latencyMs,
  Unit: 'Milliseconds'
});
```

**Phase 4: Optimize with Fast Path** (Optional)
```typescript
// Route based on complexity
if (isSimpleExecution(request)) {
  return await executeFastPath(request);  // Single Lambda
} else {
  return await executeDistributed(request);  // Multi-stage
}
```

---

## Decision Matrix

| Criterion | Single Lambda | Distributed | Winner |
|-----------|---------------|-------------|--------|
| Simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐ | Single |
| Performance (fast) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Single |
| Performance (slow) | ⭐ | ⭐⭐⭐⭐⭐ | Distributed |
| Cost (fast) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Single |
| Cost (slow) | ⭐ | ⭐⭐⭐⭐⭐ | Distributed |
| Observability | ⭐⭐ | ⭐⭐⭐⭐⭐ | Distributed |
| Fault Tolerance | ⭐⭐ | ⭐⭐⭐⭐⭐ | Distributed |
| Approval Workflow | ⭐ | ⭐⭐⭐⭐⭐ | Distributed |
| Scalability | ⭐⭐ | ⭐⭐⭐⭐⭐ | Distributed |
| Timeout Handling | ⭐ | ⭐⭐⭐⭐⭐ | Distributed |

**For NexusOPS**: Distributed wins 7/10 criteria

---

## Implementation Checklist

### Distributed Model Requirements

- [x] State persisted after each stage (DynamoDB ExecutionRecords)
- [ ] Logs persisted after each stage (DynamoDB ExecutionLogs) - **Phase 3**
- [ ] Idempotency keys for stage execution - **Phase 2**
- [ ] Stage transition logic (invoke next Lambda)
- [ ] Approval workflow pause/resume
- [ ] Stage-level metrics
- [ ] Retry logic per stage
- [ ] Error handling per stage

### Current NexusOPS Status

**Implemented** ✅:
- State machine with clear stages
- DynamoDB state persistence
- Optimistic locking (version field)
- Approval workflow (SNS notifications)

**Missing** ❌:
- Log persistence (in-memory only)
- Idempotency guarantees
- Stage-level metrics
- Explicit stage transition logic

**Estimated Effort**: 2-3 weeks to complete distributed model

---

## Final Recommendation

### For NexusOPS: Use Distributed Step-Based Model

**Reasons**:
1. Approval workflow requires it
2. Production observability requires it
3. Timeout risk is too high for single Lambda
4. Fault tolerance is critical
5. Industry standard for agent systems

**Implementation Priority**:
1. **Phase 1** (Week 1): Add log persistence
2. **Phase 2** (Week 2): Add idempotency guarantees
3. **Phase 3** (Week 3): Add stage-level metrics
4. **Phase 4** (Optional): Add fast path optimization

**Cost Impact**:
- Slightly higher cost per execution (~$0.01 vs $0.005)
- But enables production use cases
- Prevents timeout failures
- Enables approval workflows

**Complexity Impact**:
- More code to maintain
- But industry-standard patterns
- Better long-term maintainability
- Easier to debug in production

---

## Conclusion

**Decision**: Implement Distributed Step-Based Model

**Rationale**: NexusOPS is a governed agent execution engine with approval workflows. The distributed model is the only viable architecture for production use.

**Next Steps**:
1. Implement log persistence (Phase 3 of deployment plan)
2. Add idempotency guarantees (before GitHub mutations)
3. Add stage-level metrics (observability Phase 1)
4. Document stage transition logic

**Status**: Architecture decision made, implementation in progress

---

**Document Version**: 1.0  
**Decision Date**: 2026-03-06  
**Decision Owner**: Krishna (NexusOPS Architect)  
**Review Date**: After Phase 3 completion
