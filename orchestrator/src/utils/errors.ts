/**
 * errors.ts — Controlled internal error types.
 *
 * Prevents raw exceptions from leaking through the orchestrator.
 * Every expected failure scenario has a named error class.
 */

export class OrchestratorError extends Error {
    public readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = "OrchestratorError";
        this.code = code;
    }
}

export class ConcurrencyConflict extends OrchestratorError {
    constructor(executionId: string, expectedVersion: number) {
        super(
            `Concurrency conflict on execution "${executionId}" at version ${expectedVersion}. ` +
            `Record was modified by another process.`,
            "CONCURRENCY_CONFLICT"
        );
        this.name = "ConcurrencyConflict";
    }
}

export class InvalidStageTransition extends OrchestratorError {
    constructor(from: string, to: string) {
        super(
            `Invalid stage transition from "${from}" to "${to}".`,
            "INVALID_STAGE_TRANSITION"
        );
        this.name = "InvalidStageTransition";
    }
}

export class ExecutionNotFound extends OrchestratorError {
    constructor(executionId: string) {
        super(
            `Execution "${executionId}" not found.`,
            "EXECUTION_NOT_FOUND"
        );
        this.name = "ExecutionNotFound";
    }
}

export class InvalidStage extends OrchestratorError {
    constructor(stage: string) {
        super(
            `Unknown stage: "${stage}".`,
            "INVALID_STAGE"
        );
        this.name = "InvalidStage";
    }
}
