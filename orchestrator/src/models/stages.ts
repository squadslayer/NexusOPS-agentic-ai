/**
 * stages.ts — Single source of truth for NexusOPS lifecycle stages.
 *
 * ALL dispatcher logic, transition validation, and logging MUST
 * import stage definitions from this file.
 */

export enum Stage {
    /** Receive and parse user intent. */
    ASK = "ASK",
    /** Fetch relevant context from knowledge base. */
    RETRIEVE = "RETRIEVE",
    /** LLM reasoning over retrieved context. */
    REASON = "REASON",
    /** Guardrail and constraint evaluation. */
    CONSTRAINT = "CONSTRAINT",
    /** Human-in-the-loop approval gate. */
    APPROVAL_PENDING = "APPROVAL_PENDING",
    /** Execute approved actions against target systems. */
    ACT = "ACT",
    /** Validate action outcomes and detect drift. */
    VERIFY = "VERIFY",
    /** Terminal: execution completed successfully. */
    COMPLETED = "COMPLETED",
    /** Terminal: execution failed or was rejected. */
    FAILED = "FAILED",
}

/**
 * Defines which stages are valid successors of a given stage.
 * Used by the handler to enforce deterministic transitions.
 */
export const VALID_TRANSITIONS: Record<Stage, Stage[]> = {
    [Stage.ASK]: [Stage.RETRIEVE, Stage.FAILED],
    [Stage.RETRIEVE]: [Stage.REASON, Stage.FAILED],
    [Stage.REASON]: [Stage.CONSTRAINT, Stage.FAILED],
    [Stage.CONSTRAINT]: [Stage.APPROVAL_PENDING, Stage.FAILED],
    [Stage.APPROVAL_PENDING]: [Stage.ACT, Stage.FAILED],
    [Stage.ACT]: [Stage.VERIFY, Stage.FAILED],
    [Stage.VERIFY]: [Stage.COMPLETED, Stage.FAILED],
    [Stage.COMPLETED]: [],
    [Stage.FAILED]: [],
};

/**
 * Returns true if transitioning from `from` to `to` is a valid move.
 */
export function isValidTransition(from: Stage, to: Stage): boolean {
    return VALID_TRANSITIONS[from].includes(to);
}
