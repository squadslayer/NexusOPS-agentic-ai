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
import { LocalMemoryRepository, repository } from "./services/executionRepository";
import { LoggingService } from "./services/loggingService";
import { dispatchStage } from "./stageDispatcher";
import { markExpired } from "./services/approvalRepository";
import { successResponse, errorResponse, OrchestratorResponse } from "./utils/response";
import { OrchestratorError, InvalidStageTransition } from "./utils/errors";

// Use the shared singleton repository instance
const logger = new LoggingService();

/**
 * Generates a simple unique request ID.
 * In production, replace with uuid or AWS request context.
 */
function generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Notifies the BFF about an execution stage transition via HTTP POST.
 * This triggers the WebSocket broadcast to the Dashboard.
 */
async function notifyBffOfTransition(execution_id: string, stage: string, status: string): Promise<void> {
    const bffUrl = process.env.BFF_URL || "http://localhost:8000";
    try {
        const response = await fetch(`${bffUrl}/ws/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                execution_id,
                stage,
                status,
                timestamp: new Date().toISOString()
            })
        });
        if (!response.ok) {
            console.warn(`[WEBSOCKET NOTIFY] BFF returned status ${response.status}`);
        }
    } catch (err) {
        console.warn(`[WEBSOCKET NOTIFY] Failed to reach BFF at ${bffUrl}`);
    }
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

        // ── WEBSOCKET STREAMING ──
        // Notify BFF of the new stage and status for real-time dashboard updates.
        notifyBffOfTransition(updated.execution_id, updated.stage, updated.status).catch(err =>
            console.warn("[WEBSOCKET NOTIFY FAILED]", err)
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
 * Direct invocation for Phase-8 validation.
 * Run with: npm start
 *
 * Drives the complete agentic lifecycle from ASK to COMPLETED.
 * Injects a test execution plan into the input after the APPROVAL stage
 * so ACT and VERIFY can run fully in the local (non-AWS) environment.
 */
async function main() {
    console.log("=== NexusOPS Orchestrator — Phase-8 Validation ===\n");

    const request: ExecutionRequest = {
        execution_id: "exec-phase8",
        user_id: "user-nexus",
        repo_id: "repo-alpha",
        // Seed query so RETRIEVE has something to work with
        input: { query: "Update deployment configuration for production" },
    };

    // ── Step 1: ASK → RETRIEVE ──
    console.log("--- Step 1: ASK → RETRIEVE ---");
    const r1 = await handler(request);
    console.log("[ASK Result]:", JSON.stringify(r1, null, 2));

    // ── Step 2: RETRIEVE → REASON ──
    console.log("\n--- Step 2: RETRIEVE → REASON ---");
    const r2 = await handler(request);
    console.log("[RETRIEVE Result]:", JSON.stringify(r2, null, 2));

    // ── Step 3: REASON → CONSTRAINT ──
    console.log("\n--- Step 3: REASON → CONSTRAINT ---");
    const r3 = await handler(request);
    console.log("[REASON Result]:", JSON.stringify(r3, null, 2));

    // ── Step 4: CONSTRAINT → APPROVAL_PENDING ──
    console.log("\n--- Step 4: CONSTRAINT → APPROVAL_PENDING ---");
    const r4 = await handler(request);
    console.log("[CONSTRAINT Result]:", JSON.stringify(r4, null, 2));

    // ── Step 5: APPROVAL_PENDING (check / notify) ──
    console.log("\n--- Step 5: APPROVAL_PENDING ---");
    const r5 = await handler(request);
    console.log("[APPROVAL Result]:", JSON.stringify(r5, null, 2));

    // ── Inject a validated_plan directly into execution input ──
    // This bypasses Bedrock + constraint evaluation for Phase-8 local testing.
    // In production, the plan flows naturally through REASON → CONSTRAINT → APPROVAL → ACT.
    {
        const execution = await repository.getExecution(request.execution_id);

        // Only inject if execution is in APPROVAL_PENDING or ACT (plan not already present)
        const currentInput = (execution.input ?? {}) as Record<string, unknown>;
        if (!currentInput.validated_plan) {
            await repository.updateExecutionConditional(
                execution.execution_id,
                execution.version,
                {
                    input: {
                        ...currentInput,
                        validated_plan: {
                            objective: "Update deployment configuration for production",
                            estimated_risk: "low",
                            steps: [
                                {
                                    step_id: 1,
                                    tool: "update_file",
                                    action: "Update deploy config",
                                    parameters: { file: "src/deploy/config.ts" },
                                    expected_output: "Config updated",
                                    risk_level: "low",
                                },
                                {
                                    step_id: 2,
                                    tool: "create_file",
                                    action: "Create deployment manifest",
                                    parameters: { file: "src/deploy/manifest.yaml" },
                                    expected_output: "Manifest created",
                                    risk_level: "low",
                                },
                                {
                                    step_id: 3,
                                    tool: "run_ci",
                                    action: "Run deployment pipeline",
                                    parameters: { pipeline: "deploy-production" },
                                    expected_output: "Pipeline triggered",
                                    risk_level: "low",
                                },
                            ],
                        },
                    },
                }
            );
            console.log("\n[HANDLER] Test plan injected into execution input for Phase-8 local validation.");
        }
    }

    // ── Step 6: ACT → VERIFY ──
    console.log("\n--- Step 6: ACT → VERIFY ---");
    const r6 = await handler(request);
    console.log("[ACT Result]:", JSON.stringify(r6, null, 2));

    // ── Step 7: VERIFY → COMPLETED ──
    console.log("\n--- Step 7: VERIFY → COMPLETED ---");
    const r7 = await handler(request);
    console.log("[VERIFY Result]:", JSON.stringify(r7, null, 2));

    // ── Summary ──
    const finalExecution = await repository.getExecution(request.execution_id).catch(() => null);
    console.log("\n=== Phase-8 Validation Complete ===");
    console.log(`Final stage: ${finalExecution?.stage ?? "unknown"}`);
    console.log(`Final status: ${finalExecution?.status ?? "unknown"}`);

    if (finalExecution?.stage !== "COMPLETED") {
        console.error("❌ Phase-8 validation FAILED — execution did not reach COMPLETED");
        process.exit(1);
    }
    console.log("✅ Phase-8 validation PASSED — full lifecycle reached COMPLETED");
}

if (require.main === module) {
    main().catch(console.error);
}

