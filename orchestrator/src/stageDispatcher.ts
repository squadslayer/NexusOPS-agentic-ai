/**
 * stageDispatcher.ts — Core lifecycle engine.
 *
 * Routes execution deterministically through the NexusOPS agentic loop.
 * This is the CENTRAL NERVOUS SYSTEM of the orchestrator.
 *
 * Every stage function MUST return a StageResult indicating the next stage.
 * Stages that are not yet implemented return placeholder results.
 *
 * GOVERNANCE:
 *   Dispatcher SUGGESTS transitions via stage return values.
 *   Handler VALIDATES lifecycle rules before persisting.
 *   Dispatcher does NOT enforce transition validity.
 */

import { Stage } from "./models/stages";
import { Execution } from "./models/execution";
import { StageResult } from "./models/stageResult";
import { InvalidStage } from "./utils/errors";
import { askStage } from "./stages/askStage";

/**
 * Dispatches an execution to the appropriate stage handler.
 * Returns the result with the determined next stage.
 *
 * Throws InvalidStage if the execution is in an unknown stage.
 */
export async function dispatchStage(execution: Readonly<Execution>): Promise<StageResult> {
    switch (execution.stage) {
        case Stage.ASK:
            return askStage(execution);

        case Stage.RETRIEVE:
            return placeholderStage(execution, Stage.REASON, "RETRIEVE");

        case Stage.REASON:
            return placeholderStage(execution, Stage.CONSTRAINT, "REASON");

        case Stage.CONSTRAINT:
            return placeholderStage(execution, Stage.APPROVAL_PENDING, "CONSTRAINT");

        case Stage.APPROVAL_PENDING:
            return placeholderStage(execution, Stage.ACT, "APPROVAL_PENDING");

        case Stage.ACT:
            return placeholderStage(execution, Stage.VERIFY, "ACT");

        case Stage.VERIFY:
            return placeholderStage(execution, Stage.COMPLETED, "VERIFY");

        case Stage.COMPLETED:
        case Stage.FAILED:
            return {
                nextStage: execution.stage,
                output: { message: `Execution already in terminal stage: ${execution.stage}` },
            };

        default:
            throw new InvalidStage(execution.stage);
    }
}

/**
 * Placeholder for stages not yet implemented.
 * Returns a deterministic next stage for skeleton validation.
 */
function placeholderStage(execution: Readonly<Execution>, nextStage: Stage, stageName: string): StageResult {
    console.log(`[${stageName} STAGE] Placeholder — execution: ${execution.execution_id}`);
    return {
        nextStage,
        output: {
            message: `${stageName} stage completed (placeholder)`,
            execution_id: execution.execution_id,
            processed_at: new Date().toISOString(),
        },
    };
}
