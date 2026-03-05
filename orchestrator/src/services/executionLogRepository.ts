/**
 * executionLogRepository.ts — Execution step log persistence.
 *
 * Stores one log entry per executed plan step during the ACT stage.
 * Used by VERIFY stage to evaluate execution outcomes.
 *
 * DESIGN:
 *   ✅ In-memory store for Phase-8 local validation
 *   ✅ DynamoDB-ready interface (same pattern as LocalMemoryRepository)
 *   ✅ Ordered by step_number for deterministic VERIFY reads
 *   ❌ No mutations after write — logs are append-only
 *   ❌ No deletions
 *
 * DynamoDB Table: ExecutionLogs
 *   PK: execution_id (String)
 *   SK: step_number (Number)
 *   Attributes: tool, action, status, latency_ms, log_timestamp, error?
 */

export type StepStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface ExecutionStepLog {
    /** Execution record this log belongs to. */
    execution_id: string;
    /** Step index from the plan (1-based, matches ExecutionStep.step_id). */
    step_number: number;
    /** Tool that was invoked (from ALLOWED_TOOLS whitelist). */
    tool: string;
    /** Human-readable action description from the plan step. */
    action: string;
    /** Outcome of this step. */
    status: StepStatus;
    /** Wall-clock time for the tool call in milliseconds. */
    latency_ms: number;
    /** ISO-8601 timestamp of when this log was written. */
    log_timestamp: string;
    /** Error message if status is FAILED. */
    error?: string;
    /** Raw output returned by the tool handler. */
    tool_output?: string;
}

/**
 * Interface contract for execution log persistence.
 * Swap LocalMemoryLogRepository for DynamoLogRepository in production.
 */
export interface IExecutionLogRepository {
    writeStepLog(log: ExecutionStepLog): Promise<void>;
    readExecutionLogs(executionId: string): Promise<ExecutionStepLog[]>;
}

/**
 * In-memory implementation for Phase-8 local validation.
 * All logs are stored for the lifetime of the process.
 *
 * Thread-safety note: Node.js single-threaded event loop — safe for Lambda.
 */
export class LocalMemoryLogRepository implements IExecutionLogRepository {
    private store: Map<string, ExecutionStepLog[]> = new Map();

    /**
     * Appends a step log for the given execution.
     * Preserves insertion order (step_number ordering must be enforced by caller).
     */
    async writeStepLog(log: ExecutionStepLog): Promise<void> {
        const existing = this.store.get(log.execution_id) ?? [];
        existing.push({ ...log });
        this.store.set(log.execution_id, existing);

        console.log(JSON.stringify({
            event: "STEP_LOG_WRITTEN",
            execution_id: log.execution_id,
            step_number: log.step_number,
            tool: log.tool,
            status: log.status,
            latency_ms: log.latency_ms,
            ...(log.error ? { error: log.error } : {}),
        }));
    }

    /**
     * Returns all step logs for an execution, sorted by step_number ascending.
     * Returns empty array if no logs exist (not an error — VERIFY handles this).
     */
    async readExecutionLogs(executionId: string): Promise<ExecutionStepLog[]> {
        const logs = this.store.get(executionId) ?? [];
        return [...logs].sort((a, b) => a.step_number - b.step_number);
    }
}

/**
 * Singleton instance shared across ACT and VERIFY stages.
 * In production, replace with a DynamoDB-backed implementation.
 */
export const executionLogRepository = new LocalMemoryLogRepository();
