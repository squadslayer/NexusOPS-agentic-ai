/**
 * execution.ts — Execution schema and TypeScript types.
 *
 * Every orchestrator invocation operates on an Execution record.
 * The `version` field enables optimistic locking to prevent
 * concurrent mutations.
 */

import { Stage } from "./stages";

/**
 * Type alias for ISO-8601 date strings.
 * Prevents timestamp format inconsistencies across the codebase.
 */
export type ISODateString = string;

export interface Execution {
    execution_id: string;
    user_id: string;
    repo_id: string;
    stage: Stage;
    status: ExecutionStatus;
    version: number;
    input?: Record<string, unknown>;
    created_at: ISODateString;
    updated_at: ISODateString;
}

export enum ExecutionStatus {
    RUNNING = "RUNNING",
    PAUSED = "PAUSED",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

/**
 * Payload received when an orchestrator invocation is triggered.
 */
export interface ExecutionRequest {
    execution_id: string;
    user_id: string;
    repo_id: string;
    input?: Record<string, unknown>;
}

/**
 * Creates a new Execution record with default initial values.
 */
export function createExecution(request: ExecutionRequest): Execution {
    const now = new Date().toISOString();
    return {
        execution_id: request.execution_id,
        user_id: request.user_id,
        repo_id: request.repo_id,
        stage: Stage.ASK,
        status: ExecutionStatus.RUNNING,
        version: 1,
        input: request.input,
        created_at: now,
        updated_at: now,
    };
}
