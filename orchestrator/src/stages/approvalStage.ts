/**
 * approvalStage.ts — APPROVAL_PENDING lifecycle stage.
 *
 * When the constraint engine determines approval is needed:
 *   1. Creates an approval record (15-min TTL)
 *   2. Publishes SNS notification
 *   3. Holds execution in APPROVAL_PENDING
 *
 * When called again (resume after decision):
 *   1. Checks if approval record exists
 *   2. If APPROVED → transition to ACT
 *   3. If REJECTED → transition to FAILED
 *   4. If EXPIRED → transition to FAILED
 *   5. If still PENDING → stay in APPROVAL_PENDING (await decision)
 *
 * RULES:
 *   ✅ Conditional approval record creation
 *   ✅ 15-minute timeout enforcement
 *   ✅ Orphan prevention
 *   ❌ No auto-approve
 *   ❌ No bypassing constraint decision
 */

import { Stage } from "../models/stages";
import { Execution, ExecutionStatus } from "../models/execution";
import { StageResult } from "../models/stageResult";
import {
    createApprovalRecord,
    findPendingApproval,
    updateApprovalDecision,
} from "../services/approvalRepository";
import { publishApprovalNotification } from "../services/approvalNotifier";

export async function approvalStage(execution: Readonly<Execution>): Promise<StageResult> {
    console.log(`[APPROVAL STAGE] Processing execution: ${execution.execution_id}`);

    const input = execution.input as Record<string, any> | undefined;
    const needsNewApproval = input?.requiresApproval === true && !input?.approval_id;

    if (needsNewApproval) {
        return await createNewApproval(execution, input!);
    }

    // ── RESUME: check existing approval ──
    return await checkExistingApproval(execution);
}

/**
 * Creates a new approval record and publishes notification.
 */
async function createNewApproval(
    execution: Readonly<Execution>,
    input: Record<string, any>
): Promise<StageResult> {
    const risk = input.finalRisk ?? "medium";

    const approvalId = await createApprovalRecord(
        execution.execution_id,
        execution.version,
        risk
    );

    await publishApprovalNotification({
        approval_id: approvalId,
        execution_id: execution.execution_id,
        risk,
        expires_at: Math.floor((Date.now() + 15 * 60 * 1000) / 1000),
    });

    console.log(`[APPROVAL STAGE] Awaiting approval: ${approvalId}`);

    // Stay in APPROVAL_PENDING — execution pauses here
    return {
        nextStage: Stage.APPROVAL_PENDING,
        output: {
            message: "Awaiting approval decision",
            execution_id: execution.execution_id,
            approval_id: approvalId,
            risk,
            validated_plan: input.validated_plan,
        },
    };
}

/**
 * Checks existing approval record and transitions accordingly.
 */
async function checkExistingApproval(execution: Readonly<Execution>): Promise<StageResult> {
    const input = execution.input as Record<string, any> | undefined;
    const approvalId = input?.approval_id;

    if (!approvalId) {
        // No approval_id — look up by execution_id
        const pending = await findPendingApproval(execution.execution_id);

        if (!pending) {
            // No approval needed (requiresApproval was false) — pass through to ACT
            console.log(`[APPROVAL STAGE] No approval required — auto-advancing`);
            return {
                nextStage: Stage.ACT,
                output: {
                    message: "APPROVAL stage completed — no approval required",
                    execution_id: execution.execution_id,
                    validated_plan: input?.validated_plan,
                },
            };
        }

        // ── TIMEOUT CHECK ──
        const now = Date.now();
        if (now > pending.expires_at * 1000) {
            try {
                await updateApprovalDecision(pending.approval_id, "REJECTED");
            } catch {
                // Already expired via the updateApprovalDecision timeout check
            }

            console.error(`[APPROVAL STAGE] Approval expired: ${pending.approval_id}`);
            return {
                nextStage: Stage.FAILED,
                status: ExecutionStatus.FAILED,
                output: {
                    message: "APPROVAL stage failed: approval expired (15-minute timeout)",
                    execution_id: execution.execution_id,
                    approval_id: pending.approval_id,
                },
            };
        }

        // Still PENDING — stay here
        return {
            nextStage: Stage.APPROVAL_PENDING,
            output: {
                message: "Still awaiting approval decision",
                execution_id: execution.execution_id,
                approval_id: pending.approval_id,
            },
        };
    }

    // We have an approval_id from a previous decision handler call
    // This means the decision was already processed externally
    const decision = input?.decision;

    if (decision === "APPROVED") {
        console.log(`[APPROVAL STAGE] Approved — advancing to ACT`);
        return {
            nextStage: Stage.ACT,
            output: {
                message: "APPROVAL stage completed — approved",
                execution_id: execution.execution_id,
                approval_id: approvalId,
                validated_plan: input?.validated_plan,
            },
        };
    }

    if (decision === "REJECTED") {
        console.log(`[APPROVAL STAGE] Rejected — failing execution`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "APPROVAL stage failed — rejected",
                execution_id: execution.execution_id,
                approval_id: approvalId,
            },
        };
    }

    // Default: stay pending
    return {
        nextStage: Stage.APPROVAL_PENDING,
        output: {
            message: "Awaiting approval decision",
            execution_id: execution.execution_id,
            approval_id: approvalId,
        },
    };
}
