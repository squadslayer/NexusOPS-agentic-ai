/**
 * stageDispatcher.ts — Core lifecycle engine (Phase-8).
 *
 * Routes execution deterministically through the complete NexusOPS agentic loop.
 * This is the CENTRAL NERVOUS SYSTEM of the orchestrator.
 *
 * Every stage function MUST return a StageResult indicating the next stage.
 * All 7 operational stages are now fully implemented (Phase-8 complete).
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
import { retrieveStage } from "./stages/retrieveStage";
import { reasonStage } from "./stages/reasonStage";
import { constraintStage } from "./stages/constraintStage";
import { approvalStage } from "./stages/approvalStage";
import { actStage } from "./stages/actStage";
import { verifyStage } from "./stages/verifyStage";

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
            return retrieveStage(execution);

        case Stage.REASON:
            return reasonStage(execution);

        case Stage.CONSTRAINT:
            return constraintStage(execution);

        case Stage.APPROVAL_PENDING:
            return approvalStage(execution);

        case Stage.ACT:
            return actStage(execution);

        case Stage.VERIFY:
            return verifyStage(execution);

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
