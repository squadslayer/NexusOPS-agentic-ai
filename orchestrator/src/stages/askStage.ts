/**
 * askStage.ts — Mock ASK stage for Phase-3 validation.
 *
 * Returns a predictable output to:
 *   - validate transitions
 *   - test logging
 *   - verify optimistic locking
 *
 * Will be replaced with real Bedrock integration in later phases.
 */

import { Stage } from "../models/stages";
import { Execution } from "../models/execution";
import { StageResult } from "../models/stageResult";

export async function askStage(execution: Readonly<Execution>): Promise<StageResult> {
    console.log(`[ASK STAGE] Processing execution: ${execution.execution_id}`);

    return {
        nextStage: Stage.RETRIEVE,
        output: {
            message: "ASK stage completed (mock)",
            execution_id: execution.execution_id,
            processed_at: new Date().toISOString(),
        },
    };
}
