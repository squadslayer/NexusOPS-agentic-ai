/**
 * actStage.ts — ACT lifecycle stage (Phase-8, updated Phase-9).
 *
 * Executes the approved, constraint-validated execution plan step by step.
 * Each step is dispatched to the tool executor and logged to the execution log repository.
 *
 * Phase-9 additions:
 *   ✅ Track tool invocation count per execution
 *   ✅ Read total_tokens from REASON stage output (via execution.input)
 *   ✅ Enforce cost limits (invocation + token budgets) before each step
 *   ✅ Return FAILED with typed cost_limit_code on budget breach
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
import { enforceCostLimits, CostLimitExceeded } from "../services/costMonitor";

// ── PLAN EXTRACTION ──────────────────────────────────────────────────

/**
 * Extracts the validated execution plan from prior stage output.
 * Checks both the nested planner_output path and the direct validated_plan path.
 */
function extractValidatedPlan(execution: Readonly<Execution>): ExecutionPlan | null {
    const input = execution.input as Record<string, any> | undefined;

    if (input?.validated_plan && typeof input.validated_plan === "object") {
        const plan = input.validated_plan as ExecutionPlan;
        if (plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0) {
            return plan;
        }
    }

    if (input?.execution_plan && typeof input.execution_plan === "object") {
        const plan = input.execution_plan as ExecutionPlan;
        if (plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0) {
            return plan;
        }
    }

    return null;
}

/**
 * Reads the total token count forwarded from the REASON stage.
 * Returns 0 if not present (safe default — cost monitor will not false-trigger).
 */
function extractTotalTokens(execution: Readonly<Execution>): number {
    const input = execution.input as Record<string, any> | undefined;
    const tokens = input?.total_tokens;
    return typeof tokens === "number" ? tokens : 0;
}

// ── ACT STAGE ────────────────────────────────────────────────────────

/**
 * ACT stage entry point.
 * Drives sequential step execution with cost enforcement and logging.
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

    // 2. Build tool context
    const context: ToolContext = {
        execution_id: execution.execution_id,
        repo_id: execution.repo_id,
        user_id: execution.user_id,
    };

    // Phase-9: read token budget carried from REASON stage
    const totalTokens = extractTotalTokens(execution);

    // 3. Execute steps sequentially — fail fast
    const executedSteps: string[] = [];
    let invocationCount = 0;

    for (const step of plan.steps) {
        // Phase-9: enforce cost limits BEFORE executing each tool
        invocationCount++;

        try {
            enforceCostLimits(totalTokens, invocationCount, {
                execution_id: execution.execution_id,
                stage: "ACT",
            });
        } catch (err) {
            if (err instanceof CostLimitExceeded) {
                console.error(`[ACT STAGE] Cost limit exceeded before step ${step.step_id}: ${err.message}`);
                return {
                    nextStage: Stage.FAILED,
                    status: ExecutionStatus.FAILED,
                    output: {
                        message: `ACT stage aborted: ${err.message}`,
                        execution_id: execution.execution_id,
                        cost_limit_code: err.code,
                        invocation_count: invocationCount,
                        steps_completed: executedSteps.length,
                        total_steps: plan.steps.length,
                    },
                };
            }
            throw err;
        }

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

        await executionLogRepository.writeStepLog(logEntry).catch((err) =>
            console.warn(`[ACT STAGE] Log write failed for step ${step.step_id}:`, err)
        );

        // 5. Fail fast on tool failure
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
            // Phase-9: pass through for VERIFY observability
            total_tokens: totalTokens,
            invocation_count: invocationCount,
        },
    };
}
