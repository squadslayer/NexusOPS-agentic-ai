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

import { SQSEvent } from "aws-lambda";
import { Execution, ExecutionRequest, ExecutionStatus } from "./models/execution";
import { Stage, isValidTransition } from "./models/stages";
import { StageResult } from "./models/stageResult";
import { repository } from "./services/executionRepository";
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
 * 
 * Supports both direct Lambda invocation and SQS event triggers.
 */
export async function handler(
    event: ExecutionRequest | SQSEvent,
    context?: any
): Promise<OrchestratorResponse | void> {
    // 1. Detect SQS Event
    if ((event as any).Records && Array.isArray((event as any).Records)) {
        return sqsHandler(event as SQSEvent);
    }

    // 2. Direct Invocation
    return processRequest(event as ExecutionRequest, context?.awsRequestId);
}

/**
 * Handles SQS events by processing each record.
 */
async function sqsHandler(event: SQSEvent): Promise<void> {
    for (const record of event.Records) {
        try {
            const request = JSON.parse(record.body) as ExecutionRequest;
            console.log(`[SQS HANDLER] Processing message ${record.messageId} for execution ${request.execution_id}`);
            await processRequest(request, record.messageId);
        } catch (err) {
            console.error(`[SQS HANDLER ERROR] Failed to process record ${record.messageId}:`, err);
        }
    }
}

/**
 * Core business logic: drives the execution one step.
 */
async function processRequest(
    request: ExecutionRequest,
    requestId?: string
): Promise<OrchestratorResponse> {
    const reqId = requestId ?? generateRequestId();

    try {
        let execution: Execution;

        try {
            execution = await repository.getExecution(request.user_id, request.execution_id);
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
            execution.user_id,
            execution.execution_id,
            execution.version,
            { stage: result.nextStage, status: newStatus, input: result.output as Record<string, unknown> }
        );

        // ── ORPHAN APPROVAL PREVENTION ──
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
        console.error(`[HANDLER ERROR] ${message}`, error);
        return errorResponse(message, { requestId: reqId, code });
    }
}

/**
 * Direct invocation for Phase-8 validation.
 */
async function main() {
    console.log("=== NexusOPS Orchestrator — AWS Hybrid Trigger Validation ===\n");

    const request: ExecutionRequest = {
        execution_id: "exec-aws-test",
        user_id: "user-nexus",
        repo_id: "repo-alpha",
        input: { query: "AWS Deployment Verification" },
    };

    console.log("--- Simulating Direct Invocation ---");
    const r1 = await handler(request);
    console.log("[Direct Result]:", JSON.stringify(r1, null, 2));

    console.log("\n--- Simulating SQS Trigger ---");
    const sqsEvent: SQSEvent = {
        Records: [
            {
                messageId: "msg-123",
                receiptHandle: "handle",
                body: JSON.stringify(request),
                attributes: {} as any,
                messageAttributes: {},
                md5OfBody: "md5",
                eventSource: "aws:sqs",
                eventSourceARN: "arn",
                awsRegion: "us-east-1"
            }
        ]
    };
    await handler(sqsEvent);
    console.log("\n[SQS Simulation] Check console logs for 'SQS HANDLER' messages.");
}

if (require.main === module) {
    main().catch(console.error);
}
