/**
 * verifyStage.ts — VERIFY lifecycle stage (Phase-8).
 *
 * Reads all execution step logs written by the ACT stage and evaluates
 * whether the execution succeeded. Computes metrics and produces the
 * final execution summary before transitioning to COMPLETED or FAILED.
 *
 * STRICT RULES:
 *   ✅ Read execution logs from executionLogRepository
 *   ✅ Compute: success_rate, failure_count, execution_duration_ms
 *   ✅ PASS if success_rate == 100% AND no FAILED steps
 *   ✅ FAIL if any step has status FAILED
 *   ✅ FAIL if no logs exist (ACT stage should always produce at least one)
 *   ✅ Transition to COMPLETED on PASS, FAILED on FAIL
 *   ❌ No mutations — VERIFY is read-only
 *   ❌ No retries — execution outcome is final
 *   ❌ Cannot override ACT failure results
 */

import { Stage } from "../models/stages";
import { Execution, ExecutionStatus } from "../models/execution";
import { StageResult } from "../models/stageResult";
import { executionLogRepository, ExecutionStepLog } from "../services/executionLogRepository";

// ── METRICS ──────────────────────────────────────────────────────────

interface VerificationMetrics {
    total_steps: number;
    successful_steps: number;
    failed_steps: number;
    skipped_steps: number;
    /** Percentage of successful steps (0–100, rounded to 2 decimal places). */
    success_rate: number;
    /** Sum of all step latencies in milliseconds (approximate total I/O time). */
    execution_duration_ms: number;
    verification_status: "PASS" | "FAIL";
}

/**
 * Computes verification metrics from a set of step logs.
 */
function computeMetrics(logs: ExecutionStepLog[]): VerificationMetrics {
    const total_steps = logs.length;
    const successful_steps = logs.filter(l => l.status === "SUCCESS").length;
    const failed_steps = logs.filter(l => l.status === "FAILED").length;
    const skipped_steps = logs.filter(l => l.status === "SKIPPED").length;

    const success_rate =
        total_steps > 0
            ? Math.round((successful_steps / total_steps) * 100 * 100) / 100
            : 0;

    const execution_duration_ms = logs.reduce((sum, l) => sum + l.latency_ms, 0);

    const verification_status: "PASS" | "FAIL" =
        failed_steps === 0 && successful_steps === total_steps && total_steps > 0
            ? "PASS"
            : "FAIL";

    return {
        total_steps,
        successful_steps,
        failed_steps,
        skipped_steps,
        success_rate,
        execution_duration_ms,
        verification_status,
    };
}

// ── VERIFY STAGE ─────────────────────────────────────────────────────

/**
 * VERIFY stage entry point.
 * Reads ACT logs, evaluates outcomes, transitions to COMPLETED or FAILED.
 */
export async function verifyStage(execution: Readonly<Execution>): Promise<StageResult> {
    console.log(`[VERIFY STAGE] Processing execution: ${execution.execution_id}`);

    // 1. Read all step logs written by ACT stage
    const logs = await executionLogRepository.readExecutionLogs(execution.execution_id);

    // 2. Guard: no logs is an unexpected state (ACT should always write at least one)
    if (logs.length === 0) {
        console.error(`[VERIFY STAGE] No execution logs found for: ${execution.execution_id}`);
        return {
            nextStage: Stage.FAILED,
            status: ExecutionStatus.FAILED,
            output: {
                message: "VERIFY stage failed: no execution logs found — ACT stage may not have run",
                execution_id: execution.execution_id,
                verification_status: "FAIL",
            },
        };
    }

    // 3. Compute verification metrics
    const metrics = computeMetrics(logs);

    console.log(JSON.stringify({
        event: "VERIFY_METRICS",
        execution_id: execution.execution_id,
        ...metrics,
    }));

    // 4. Evaluate: PASS → COMPLETED, FAIL → FAILED
    if (metrics.verification_status === "PASS") {
        console.log(
            `[VERIFY STAGE] Verification PASSED — ${metrics.successful_steps}/${metrics.total_steps} steps successful` +
            ` (${metrics.execution_duration_ms}ms total)`
        );

        return {
            nextStage: Stage.COMPLETED,
            status: ExecutionStatus.COMPLETED,
            output: {
                message: "VERIFY stage completed — execution verified successfully",
                execution_id: execution.execution_id,
                verification_status: "PASS",
                total_steps: metrics.total_steps,
                successful_steps: metrics.successful_steps,
                failed_steps: metrics.failed_steps,
                success_rate: metrics.success_rate,
                execution_duration_ms: metrics.execution_duration_ms,
            },
        };
    }

    // FAIL path
    const failedLogs = logs.filter(l => l.status === "FAILED");
    const failureSummary = failedLogs.map(l =>
        `step ${l.step_number} (${l.tool}): ${l.error ?? "unknown error"}`
    );

    console.error(
        `[VERIFY STAGE] Verification FAILED — ${metrics.failed_steps} step(s) failed: ` +
        failureSummary.join(", ")
    );

    return {
        nextStage: Stage.FAILED,
        status: ExecutionStatus.FAILED,
        output: {
            message: "VERIFY stage failed — execution did not complete successfully",
            execution_id: execution.execution_id,
            verification_status: "FAIL",
            total_steps: metrics.total_steps,
            successful_steps: metrics.successful_steps,
            failed_steps: metrics.failed_steps,
            success_rate: metrics.success_rate,
            execution_duration_ms: metrics.execution_duration_ms,
            failure_summary: failureSummary,
        },
    };
}
