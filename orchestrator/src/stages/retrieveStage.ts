/**
 * retrieveStage.ts — RETRIEVE lifecycle stage (Phase-4).
 *
 * Fetches relevant knowledge base context for the current execution.
 * Returns chunk references in StageResult.output for downstream stages.
 *
 * STRICT RULES:
 *   ✅ Read execution.input to build query
 *   ✅ Call retrievalService
 *   ✅ Return StageResult with context_refs
 *   ✅ FAIL if retrieval returns zero chunks
 *   ❌ Must NOT write to DB
 *   ❌ Must NOT log transitions
 *   ❌ Must NOT mutate execution
 *   ❌ Must NOT store large data in output
 */

import { Stage } from "../models/stages";
import { Execution, ExecutionStatus } from "../models/execution";
import { StageResult } from "../models/stageResult";
import { retrieveContext } from "../services/retrievalService";

export async function retrieveStage(execution: Readonly<Execution>): Promise<StageResult> {
    console.log(`[RETRIEVE STAGE] Processing execution: ${execution.execution_id}`);

    const query = buildQuery(execution);

    const retrieval = await retrieveContext(query, execution.repo_id);

    if (retrieval.chunk_refs.length === 0) {
        console.error(`[RETRIEVE STAGE] Empty retrieval — cannot proceed to REASON`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "RETRIEVE stage failed: no context retrieved",
                execution_id: execution.execution_id,
                query: retrieval.query,
            },
        };
    }

    return {
        nextStage: Stage.REASON,
        output: {
            message: "RETRIEVE stage completed",
            execution_id: execution.execution_id,
            context_refs: retrieval.chunk_refs,
            query: retrieval.query,
            retrieved_at: retrieval.retrieved_at,
        },
    };
}

/**
 * Builds a retrieval query from execution input.
 * Falls back to a default query if no input is provided.
 */
function buildQuery(execution: Readonly<Execution>): string {
    if (execution.input && typeof execution.input["query"] === "string") {
        return execution.input["query"];
    }

    return `NexusOPS context retrieval for execution ${execution.execution_id}`;
}
