/**
 * executionRepository.ts — Abstract state persistence layer.
 *
 * The orchestrator depends ONLY on this interface.
 * Concrete implementations swap in without touching core logic:
 *   - LocalMemoryRepository  (Phase-3, in-memory)
 *   - DynamoRepository       (later phases)
 *
 * CONCURRENCY CONTRACT:
 *   updateExecutionConditional() is the ONLY place where version
 *   comparison and increment happen. Callers must NEVER mutate
 *   the version field directly.
 *
 * GOVERNANCE BOUNDARY:
 *   Repository validates VERSION ONLY — lifecycle transition rules
 *   belong in the handler layer.
 */

import { Execution, ExecutionRequest, createExecution } from "../models/execution";
import { ConcurrencyConflict, ExecutionNotFound } from "../utils/errors";

/**
 * Fields that are immutable after creation — never passed in updates.
 */
type ImmutableFields = "execution_id" | "user_id" | "repo_id" | "created_at";

export interface IExecutionRepository {
    getExecution(executionId: string): Promise<Execution>;
    createExecution(request: ExecutionRequest): Promise<Execution>;
    updateExecutionConditional(
        executionId: string,
        expectedVersion: number,
        updates: Partial<Omit<Execution, ImmutableFields>>
    ): Promise<Execution>;
}

/**
 * In-memory implementation for Phase-3 validation.
 * Data lives only for the process lifetime.
 */
export class LocalMemoryRepository implements IExecutionRepository {
    private store: Map<string, Execution> = new Map();

    /**
     * Retrieves an execution record.
     * Throws ExecutionNotFound if the record does not exist.
     */
    async getExecution(executionId: string): Promise<Execution> {
        const record = this.store.get(executionId);
        if (!record) {
            throw new ExecutionNotFound(executionId);
        }
        return { ...record };
    }

    /**
     * Creates a new execution record.
     */
    async createExecution(request: ExecutionRequest): Promise<Execution> {
        const execution = createExecution(request);
        this.store.set(execution.execution_id, execution);
        return { ...execution };
    }

    /**
     * Persists partial updates to an execution ONLY if the version matches
     * (optimistic lock). Version increment happens atomically inside this
     * method — callers never touch the version field.
     *
     * This method validates VERSION ONLY. Lifecycle stage transition rules
     * are enforced by the handler layer.
     */
    async updateExecutionConditional(
        executionId: string,
        expectedVersion: number,
        updates: Partial<Omit<Execution, ImmutableFields>>
    ): Promise<Execution> {
        const existing = this.store.get(executionId);

        if (!existing) {
            throw new ExecutionNotFound(executionId);
        }

        if (existing.version !== expectedVersion) {
            throw new ConcurrencyConflict(executionId, expectedVersion);
        }

        const updated: Execution = {
            ...existing,
            ...updates,
            version: existing.version + 1,
            updated_at: new Date().toISOString(),
        };

        this.store.set(executionId, updated);
        return { ...updated };
    }
}
