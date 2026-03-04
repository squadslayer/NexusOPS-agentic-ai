/**
 * actStage.ts — ACT lifecycle stage (Phase-8).
 *
 * Executes the approved, constraint-validated execution plan step by step.
 * Each step is dispatched to the tool executor and logged to the execution log repository.
 *
 * STRICT RULES:
 *   ✅ Extract validated_plan from execution.input
 *   ✅ Execute steps SEQUENTIALLY — one step at a time
 *   ✅ Write a step log entry for EVERY executed step
 *   ✅ FAIL FAST on first tool failure — do not continue to next step
 *   ✅ Transition to VERIFY on full plan success
 *   ✅ Transition to FAILED on any tool failure or missing plan
 *   ❌ No parallel execution
 *   ❌ No retries on tool failure
 *   ❌ Cannot skip steps
 *   ❌ Cannot execute tools not in ALLOWED_TOOLS (constraint engine already blocked them)
 */

import { Stage } from "../models/stages";
import { Execution, ExecutionStatus } from "../models/execution";
import { StageResult } from "../models/stageResult";
import { ExecutionPlan, ExecutionStep } from "../constraints/constraintEngine";
import { executeTool, ToolContext } from "../services/toolExecutor";
import { executionLogRepository, ExecutionStepLog } from "../services/executionLogRepository";

// ── PLAN EXTRACTION ──────────────────────────────────────────────────

/**
 * Extracts the validated execution plan from prior stage output.
 * Checks both the nested planner_output path and the direct validated_plan path
 * (matching the data flow from constraintStage and approvalStage).
 */
function extractValidatedPlan(execution: Readonly<Execution>): ExecutionPlan | null {
    const input = execution.input as Record<string, any> | undefined;

    // Path 1: passed from approvalStage output: { validated_plan: ExecutionPlan }
    if (input?.validated_plan && typeof input.validated_plan === "object") {
        const plan = input.validated_plan as ExecutionPlan;
        if (plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0) {
            return plan;
        }
    }

    // Path 2: passed directly: { execution_plan: ExecutionPlan }
    if (input?.execution_plan && typeof input.execution_plan === "object") {
        const plan = input.execution_plan as ExecutionPlan;
        if (plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0) {
            return plan;
        }
    }

    return null;
}

// ── ACT STAGE ────────────────────────────────────────────────────────

/**
 * ACT stage entry point.
 * Drives sequential step execution and handles logging and failure propagation.
 */
export async function actStage(execution: Readonly<Execution>): Promise<StageResult> {
    console.log(`[ACT STAGE] Processing execution: ${execution.execution_id}`);

    // 1. Extract validated plan
    const plan = extractValidatedPlan(execution);

    if (!plan) {
        console.error(`[ACT STAGE] No validated execution plan found in execution input`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "ACT stage failed: no validated execution plan found",
                execution_id: execution.execution_id,
            },
        };
    }

    console.log(`[ACT STAGE] Executing plan: "${plan.objective}" — ${plan.steps.length} step(s)`);

    // 2. Build tool context for all steps
    const context: ToolContext = {
        execution_id: execution.execution_id,
        repo_id: execution.repo_id,
        user_id: execution.user_id,
    };

    // 3. Execute steps sequentially — fail fast
    const executedSteps: string[] = [];

    for (const step of plan.steps) {
        console.log(`[ACT STAGE] Step ${step.step_id}/${plan.steps.length}: ${step.tool} — ${step.action}`);

        const result = await executeTool(step, context);

        // 4. Write step log regardless of success or failure
        const logEntry: ExecutionStepLog = {
            execution_id: execution.execution_id,
            step_number: step.step_id,
            tool: step.tool,
            action: step.action,
            status: result.success ? "SUCCESS" : "FAILED",
            latency_ms: result.latency_ms,
            log_timestamp: new Date().toISOString(),
            ...(result.output ? { tool_output: result.output } : {}),
            ...(result.error ? { error: result.error } : {}),
        };

        // Log write is non-blocking observable (like loggingService pattern)
        await executionLogRepository.writeStepLog(logEntry).catch((err) =>
            console.warn(`[ACT STAGE] Log write failed for step ${step.step_id}:`, err)
        );

        // 5. Fail fast: abort on first tool failure
        if (!result.success) {
            console.error(
                `[ACT STAGE] Step ${step.step_id} failed (${step.tool}): ${result.error}`
            );
            return {
                nextStage: Stage.FAILED,
                status: ExecutionStatus.FAILED,
                output: {
                    message: `ACT stage failed at step ${step.step_id}: ${result.error}`,
                    execution_id: execution.execution_id,
                    failed_step: step.step_id,
                    failed_tool: step.tool,
                    steps_completed: executedSteps.length,
                    total_steps: plan.steps.length,
                },
            };
        }

        executedSteps.push(`${step.step_id}:${step.tool}`);
        console.log(`[ACT STAGE] Step ${step.step_id} completed (${result.latency_ms}ms)`);
    }

    // 6. All steps succeeded — transition to VERIFY
    console.log(
        `[ACT STAGE] All ${plan.steps.length} step(s) completed — transitioning to VERIFY`
    );

    return {
        nextStage: Stage.VERIFY,
        output: {
            message: "ACT stage completed — all steps executed successfully",
            execution_id: execution.execution_id,
            total_steps: plan.steps.length,
            steps_completed: executedSteps.length,
            objective: plan.objective,
        },
    };
}
