/**
 * constraintStage.ts — CONSTRAINT lifecycle stage (Phase-6).
 *
 * Deterministic validation gate between REASON and state mutation.
 * Runs the constraint engine against the planner's execution plan.
 *
 * STRICT RULES:
 *   ✅ Extract execution_plan from previous stage output
 *   ✅ Run constraint engine (pure function, no AI)
 *   ✅ Override planner risk with engine-calculated risk
 *   ✅ FAIL on any constraint violation
 *   ✅ Require approval if risk is high
 *   ❌ No external calls
 *   ❌ No retries
 *   ❌ Cannot override engine decision
 */

import { Stage } from "../models/stages";
import { Execution, ExecutionStatus } from "../models/execution";
import { StageResult } from "../models/stageResult";
import {
    validateExecutionPlan,
    ExecutionPlan,
    ConstraintResult,
} from "../constraints/constraintEngine";

export async function constraintStage(execution: Readonly<Execution>): Promise<StageResult> {
    console.log(`[CONSTRAINT STAGE] Processing execution: ${execution.execution_id}`);

    const plan = extractPlan(execution);

    if (!plan) {
        console.error(`[CONSTRAINT STAGE] No execution plan found in execution input`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "CONSTRAINT stage failed: no execution plan found",
                execution_id: execution.execution_id,
            },
        };
    }

    const result: ConstraintResult = validateExecutionPlan(plan);

    console.log(JSON.stringify({
        event: "CONSTRAINT_EVALUATION",
        execution_id: execution.execution_id,
        allowed: result.allowed,
        finalRisk: result.finalRisk,
        requiresApproval: result.requiresApproval,
        violations: result.violations,
    }));

    if (!result.allowed) {
        console.error(`[CONSTRAINT STAGE] Plan rejected: ${result.reason}`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: `CONSTRAINT stage failed: ${result.reason}`,
                execution_id: execution.execution_id,
                violations: result.violations,
                finalRisk: result.finalRisk,
            },
        };
    }

    if (result.requiresApproval) {
        console.log(`[CONSTRAINT STAGE] Plan requires approval (risk: ${result.finalRisk})`);
        return {
            nextStage: Stage.APPROVAL_PENDING,
            output: {
                message: "CONSTRAINT stage completed — approval required",
                execution_id: execution.execution_id,
                finalRisk: result.finalRisk,
                requiresApproval: true,
                validated_plan: plan,
            },
        };
    }

    console.log(`[CONSTRAINT STAGE] Plan approved (risk: ${result.finalRisk})`);

    return {
        nextStage: Stage.APPROVAL_PENDING,
        output: {
            message: "CONSTRAINT stage completed — plan approved",
            execution_id: execution.execution_id,
            finalRisk: result.finalRisk,
            requiresApproval: false,
            validated_plan: plan,
        },
    };
}

/**
 * Extracts the execution plan from previous stage output.
 */
function extractPlan(execution: Readonly<Execution>): ExecutionPlan | null {
    const input = execution.input as Record<string, any> | undefined;
    if (input?.planner_output?.execution_plan) {
        return input.planner_output.execution_plan as ExecutionPlan;
    }
    if (input?.execution_plan) {
        return input.execution_plan as ExecutionPlan;
    }
    return null;
}
