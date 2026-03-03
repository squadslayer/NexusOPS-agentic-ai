/**
 * reasonStage.ts — REASON lifecycle stage (Phase-5).
 *
 * Structured planner: builds prompt, invokes Bedrock (or mock),
 * parses JSON, validates schema, enforces tool whitelist.
 *
 * STRICT RULES:
 *   ✅ Build deterministic prompt from execution context
 *   ✅ Invoke planner model (JSON-only output)
 *   ✅ Parse and validate response
 *   ✅ Return validated plan in StageResult.output
 *   ✅ FAIL on invalid JSON or schema violation
 *   ❌ Must NOT store prompt in DB
 *   ❌ Must NOT re-store retrieved documents
 *   ❌ Must NOT retry with higher temperature
 *   ❌ Must NOT allow free-text output
 */

import { Stage } from "../models/stages";
import { Execution, ExecutionStatus } from "../models/execution";
import { StageResult } from "../models/stageResult";
import { buildPlannerPrompt } from "../utils/promptBuilder";
import { invokePlanner } from "../utils/bedrockClient";
import { validatePlannerOutput, PlannerValidationError } from "../utils/validator";

export async function reasonStage(execution: Readonly<Execution>): Promise<StageResult> {
    console.log(`[REASON STAGE] Processing execution: ${execution.execution_id}`);

    const userIntent = extractIntent(execution);
    const contextRefs = extractContextRefs(execution);

    const prompt = buildPlannerPrompt(userIntent, contextRefs, [
        "Retrieved context for planning (refs only — content in ContextChunks)",
    ]);

    let rawText: string;
    try {
        rawText = await invokePlanner(prompt);
    } catch (err) {
        console.error(`[REASON STAGE] Planner invocation failed:`, err);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "REASON stage failed: planner invocation error",
                execution_id: execution.execution_id,
            },
        };
    }

    let plannerOutput: unknown;
    try {
        plannerOutput = JSON.parse(rawText);
    } catch {
        console.error(`[REASON STAGE] Planner returned invalid JSON`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "REASON stage failed: planner returned invalid JSON",
                execution_id: execution.execution_id,
            },
        };
    }

    try {
        validatePlannerOutput(plannerOutput);
    } catch (err) {
        const msg = err instanceof PlannerValidationError ? err.message : "Unknown validation error";
        console.error(`[REASON STAGE] ${msg}`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: `REASON stage failed: ${msg}`,
                execution_id: execution.execution_id,
            },
        };
    }

    // ── GUARDRAIL BLOCK DETECTION ──
    // If guardrail blocks input, Bedrock returns empty steps.
    // Do NOT continue to CONSTRAINT with an empty plan.
    const plan = (plannerOutput as any).execution_plan;
    if (!plan.steps.length) {
        console.error(`[REASON STAGE] Execution blocked by guardrail`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "REASON stage failed: execution blocked by guardrail",
                execution_id: execution.execution_id,
            },
        };
    }

    console.log(`[REASON STAGE] Plan validated — ${plan.steps.length} steps`);

    return {
        nextStage: Stage.CONSTRAINT,
        output: {
            message: "REASON stage completed",
            execution_id: execution.execution_id,
            planner_output: plannerOutput,
        },
    };
}

/**
 * Extracts user intent from execution input.
 */
function extractIntent(execution: Readonly<Execution>): string {
    if (execution.input && typeof execution.input["query"] === "string") {
        return execution.input["query"];
    }
    return `Automated execution plan for ${execution.execution_id}`;
}

/**
 * Extracts context_refs from the previous stage output stored in execution.
 * Falls back to empty array if not available.
 */
function extractContextRefs(execution: Readonly<Execution>): string[] {
    if (execution.input && Array.isArray(execution.input["context_refs"])) {
        return execution.input["context_refs"];
    }
    return [];
}
