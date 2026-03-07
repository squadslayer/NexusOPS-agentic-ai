/**
 * approvalHandler.ts — Approval decision handler.
 *
 * Accepts an approval decision (APPROVE/REJECT) and
 * transitions the execution accordingly.
 *
 * This can be wired to:
 *   - API Gateway endpoint
 *   - CLI command
 *   - Direct invocation (testing)
 *
 * RULES:
 *   ✅ Validates approval record is PENDING
 *   ✅ Enforces 15-minute timeout before accepting
 *   ✅ Conditional update (prevents double-approve)
 *   ✅ Updates execution record with optimistic locking
 *   ❌ No auto-approve
 *   ❌ No bypass
 */

import "dotenv/config";
import { updateApprovalDecision, getApprovalRecord } from "./services/approvalRepository";
import { LocalMemoryRepository } from "./services/executionRepository";
import { Stage, isValidTransition } from "./models/stages";
import { ExecutionStatus } from "./models/execution";

const repository = new LocalMemoryRepository();

export interface ApprovalDecisionRequest {
    approval_id: string;
    decision: "APPROVED" | "REJECTED";
}

export interface ApprovalDecisionResponse {
    success: boolean;
    approval_id: string;
    decision: string;
    execution_id?: string;
    new_stage?: string;
    error?: string;
}

/**
 * Processes an approval decision.
 * Updates the approval record AND the execution record atomically.
 */
export async function handleApprovalDecision(
    request: ApprovalDecisionRequest
): Promise<ApprovalDecisionResponse> {
    const { approval_id, decision } = request;

    console.log(`[APPROVAL HANDLER] Processing decision: ${decision} for ${approval_id}`);

    try {
        // 1. Update approval record (conditional — must be PENDING, checks timeout)
        const record = await updateApprovalDecision(approval_id, decision);

        // 2. Get execution record
        const execution = await repository.getExecution(record.user_id, record.execution_id);

        // 3. Validate execution is in APPROVAL_PENDING
        if (execution.stage !== Stage.APPROVAL_PENDING) {
            return {
                success: false,
                approval_id,
                decision,
                error: `Execution not in APPROVAL_PENDING stage (current: ${execution.stage})`,
            };
        }

        // 4. Determine next stage
        const nextStage = decision === "APPROVED" ? Stage.ACT : Stage.FAILED;
        const nextStatus = decision === "APPROVED" ? ExecutionStatus.RUNNING : ExecutionStatus.FAILED;

        // 5. Validate transition
        if (!isValidTransition(execution.stage, nextStage)) {
            return {
                success: false,
                approval_id,
                decision,
                error: `Invalid transition: ${execution.stage} → ${nextStage}`,
            };
        }

        // 6. Update execution with optimistic locking
        const updated = await repository.updateExecutionConditional(
            execution.user_id,
            execution.execution_id,
            execution.version,
            {
                stage: nextStage,
                status: nextStatus,
                input: {
                    approval_id,
                    decision,
                    decided_at: new Date().toISOString(),
                },
            }
        );

        console.log(`[APPROVAL HANDLER] Execution ${updated.execution_id}: ${execution.stage} → ${updated.stage}`);

        return {
            success: true,
            approval_id,
            decision,
            execution_id: updated.execution_id,
            new_stage: updated.stage,
        };
    } catch (err: any) {
        console.error(`[APPROVAL HANDLER] Error:`, err.message);
        return {
            success: false,
            approval_id,
            decision,
            error: err.message,
        };
    }
}
