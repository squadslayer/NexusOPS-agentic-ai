/**
 * handler.ts — Lambda entry point for the NexusOPS Orchestrator.
 *
 * Responsibility chain:
 *   1. Receive invocation
 *   2. Generate request_id if absent
 *   3. Load execution record
 *   4. Dispatch to current stage
 *   5. Validate lifecycle transition (FINAL GOVERNANCE GATE)
 *   6. Persist updated state (atomic version check)
 *   7. Write transition log (non-blocking)
 *   8. Return lifecycle state
 *
 * NO business logic lives here.
 */

import { Execution, ExecutionRequest, ExecutionStatus } from "./models/execution";
import { Stage, isValidTransition } from "./models/stages";
import { StageResult } from "./models/stageResult";
import { LocalMemoryRepository } from "./services/executionRepository";
import { LoggingService } from "./services/loggingService";
import { dispatchStage } from "./stageDispatcher";
import { markExpired } from "./services/approvalRepository";
import { successResponse, errorResponse, OrchestratorResponse } from "./utils/response";
import { OrchestratorError, InvalidStageTransition } from "./utils/errors";

const repository = new LocalMemoryRepository();
const logger = new LoggingService();

/**
 * Generates a simple unique request ID.
 * In production, replace with uuid or AWS request context.
 */
function generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Main orchestrator handler.
 * Accepts an execution request and drives it through one lifecycle step.
 */
export async function handler(
    request: ExecutionRequest,
    requestId?: string
): Promise<OrchestratorResponse> {
    const reqId = requestId ?? generateRequestId();

    try {
        let execution: Execution;

        try {
            execution = await repository.getExecution(request.execution_id);
        } catch {
            execution = await repository.createExecution(request);
            console.log(`[HANDLER] Created new execution: ${execution.execution_id}`);
        }

        if (execution.stage === Stage.COMPLETED || execution.stage === Stage.FAILED) {
            return successResponse(execution, { requestId: reqId, terminal: true });
        }

        const previousStage = execution.stage;

        const result = await dispatchStage(execution);

        // ── FINAL GOVERNANCE GATE ──
        // Handler re-validates the suggested transition.
        // Dispatcher suggests, handler enforces.
        if (result.nextStage !== previousStage && !isValidTransition(previousStage, result.nextStage)) {
            throw new InvalidStageTransition(previousStage, result.nextStage);
        }

        const newStatus = result.status
            ?? (result.nextStage === Stage.COMPLETED
                ? ExecutionStatus.COMPLETED
                : result.nextStage === Stage.FAILED
                    ? ExecutionStatus.FAILED
                    : ExecutionStatus.RUNNING);

        const updated = await repository.updateExecutionConditional(
            execution.execution_id,
            execution.version,
            { stage: result.nextStage, status: newStatus, input: result.output as Record<string, unknown> }
        );

        // ── ORPHAN APPROVAL PREVENTION ──
        // If transitioning to ACT or FAILED, ensure no PENDING approval record is left behind.
        if (updated.stage === Stage.ACT || updated.stage === Stage.FAILED) {
            const approvalId = (execution.input as Record<string, any>)?.approval_id ||
                (result.output as Record<string, any>)?.approval_id;
            if (approvalId) {
                await markExpired(approvalId).catch(err =>
                    console.warn(`[ORPHAN CLEANUP FAILED] approval_id: ${approvalId}`, err)
                );
            }
        }

        // ── NON-BLOCKING LOGGING ──
        // Async errors remain observable but never halt execution.
        await logger.logTransition(
            reqId,
            updated.execution_id,
            previousStage,
            updated.stage,
            "SUCCESS"
        ).catch((err) =>
            console.warn("[LOGGING FAILED]", err)
        );

        return successResponse(
            {
                execution: updated,
                stageOutput: result.output,
                transitionLogs: logger.getLogsForExecution(updated.execution_id),
            },
            { requestId: reqId, previousStage, currentStage: updated.stage }
        );
    } catch (error: unknown) {
        const message = error instanceof OrchestratorError ? error.message : "Internal orchestrator error";
        const code = error instanceof OrchestratorError ? error.code : "UNKNOWN_ERROR";
        console.error(`[HANDLER ERROR] ${message}`);
        return errorResponse(message, { requestId: reqId, code });
    }
}

/**
 * Direct invocation for Phase-7 validation.
 * Run with: npm start
 */
async function main() {
    console.log("=== NexusOPS Orchestrator — Phase-7 Validation ===\n");

    const request: ExecutionRequest = {
        execution_id: "exec-001",
        user_id: "user-nexus",
        repo_id: "repo-alpha",
    };

    console.log("Step 1: ASK → RETRIEVE...\n");
    const r1 = await handler(request);
    console.log("\n[ASK Result]:", JSON.stringify(r1, null, 2));

    console.log("\n--- Step 2: RETRIEVE → REASON... ---\n");
    const r2 = await handler(request);
    console.log("\n[RETRIEVE Result]:", JSON.stringify(r2, null, 2));

    console.log("\n--- Step 3: REASON → CONSTRAINT... ---\n");
    const r3 = await handler(request);
    console.log("\n[REASON Result]:", JSON.stringify(r3, null, 2));

    console.log("\n--- Step 4: CONSTRAINT → APPROVAL_PENDING... ---\n");
    const r4 = await handler(request);
    console.log("\n[CONSTRAINT Result]:", JSON.stringify(r4, null, 2));

    console.log("\n--- Step 5: APPROVAL_PENDING (awaiting / auto-advance)... ---\n");
    const r5 = await handler(request);
    console.log("\n[APPROVAL Result]:", JSON.stringify(r5, null, 2));

    // ── Test approval decision handler ──
    const { handleApprovalDecision } = await import("./approvalHandler");

    // Extract approval_id from the approval stage output
    const approvalOutput = (r5 as any)?.data?.stageOutput;
    const approvalId = approvalOutput?.approval_id;

    if (approvalId) {
        console.log(`\n--- Step 6: APPROVE decision for ${approvalId}... ---\n`);
        const decision = await handleApprovalDecision({
            approval_id: approvalId,
            decision: "APPROVED",
        });
        console.log("\n[Decision Result]:", JSON.stringify(decision, null, 2));
    } else {
        console.log("\n--- Step 5 auto-advanced (no approval required) ---");
    }

    console.log("\n=== Phase-7 Validation Complete ===");
}

main().catch(console.error);

