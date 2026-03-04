/**
 * constraintStage.ts — CONSTRAINT lifecycle stage (Phase-6, updated Phase-9).
 *
 * Deterministic validation gate between REASON and state mutation.
 * Runs the constraint engine against the planner's execution plan.
 *
 * Phase-9 additions:
 *   ✅ Compute SHA-256 risk hash of the validated plan
 *   ✅ Look up risk hash in risk registry
 *   ✅ Block execution if recurrence threshold exceeded
 *   ✅ Record or increment occurrence in registry
 *   ✅ Pass risk_hash forward in output for audit trail
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
import { computeRiskHash } from "../utils/riskHasher";
import { riskRegistry, isRecurrenceBlocked } from "../services/riskRegistryRepository";

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

    // ── Phase-9: RISK REGISTRY ENFORCEMENT ──────────────────────────────

    // 1. Compute deterministic fingerprint of the validated plan
    const riskHash = computeRiskHash(plan);

    console.log(JSON.stringify({
        event: "RISK_HASH_COMPUTED",
        execution_id: execution.execution_id,
        risk_hash: riskHash.slice(0, 12) + "...",
        risk_level: result.finalRisk,
    }));

    // 2. Look up existing risk record
    const existingRecord = await riskRegistry.getRisk(riskHash);

    if (existingRecord) {
        // 3. Check recurrence threshold BEFORE incrementing
        if (isRecurrenceBlocked(existingRecord)) {
            console.error(
                `[CONSTRAINT STAGE] Risk recurrence blocked — hash: ${riskHash.slice(0, 12)}, ` +
                `count: ${existingRecord.occurrence_count}, level: ${existingRecord.risk_level}`
            );
            return {
                nextStage: Stage.FAILED,
                status: ExecutionStatus.FAILED,
                output: {
                    message: "CONSTRAINT stage failed: repeated high-risk execution detected",
                    execution_id: execution.execution_id,
                    reason: "RISK_RECURRENCE_BLOCKED",
                    risk_hash: riskHash,
                    occurrence_count: existingRecord.occurrence_count,
                    risk_level: existingRecord.risk_level,
                },
            };
        }

        // 4. Increment occurrence count for existing (not-yet-blocked) record
        await riskRegistry.incrementOccurrence(riskHash);
    } else {
        // 5. First time seeing this plan — record it
        await riskRegistry.recordRisk(riskHash, result.finalRisk);
    }

    // ── END Phase-9 ──────────────────────────────────────────────────────

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
                risk_hash: riskHash,
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
            risk_hash: riskHash,
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
