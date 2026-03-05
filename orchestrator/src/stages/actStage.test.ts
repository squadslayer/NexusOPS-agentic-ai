/**
 * actStage.test.ts — Unit tests for the ACT lifecycle stage (Phase-8).
 *
 * Follows the same vanilla ts-node test pattern as constraintEngine.test.ts.
 * Runs without Jest — execute with: npx ts-node src/stages/actStage.test.ts
 *
 * Coverage:
 *   1. Valid plan → ACT returns nextStage: VERIFY
 *   2. Missing plan → ACT returns nextStage: FAILED
 *   3. Tool failure in mid-plan → ACT returns nextStage: FAILED, aborts remaining steps
 *   4. Execution logs written for all executed steps (including the failed one)
 */

import { actStage } from "./actStage";
import { executionLogRepository } from "../services/executionLogRepository";
import { Stage } from "../models/stages";
import { ExecutionStatus } from "../models/execution";
import type { Execution } from "../models/execution";
import type { ExecutionStep } from "../constraints/constraintEngine";

// ── HELPERS ──────────────────────────────────────────────────────────

console.log("=== ACT Stage Unit Tests ===\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.error(`  ❌ ${name}`);
        failed++;
    }
}

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
    return {
        step_id: 1,
        tool: "update_file",
        action: "Update config.ts",
        parameters: { file: "src/config.ts" },
        expected_output: "Config updated",
        risk_level: "low",
        ...overrides,
    };
}

function makeExecution(overrides: Partial<Execution> = {}): Readonly<Execution> {
    return {
        execution_id: `test-exec-${Date.now()}`,
        user_id: "user-test",
        repo_id: "repo-test",
        stage: Stage.ACT,
        status: ExecutionStatus.RUNNING,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

// ── TEST 1: Valid plan → VERIFY ──────────────────────────────────────

async function test_valid_plan_transitions_to_verify() {
    console.log("\nTest 1: Valid plan → nextStage: VERIFY");

    const execution = makeExecution({
        execution_id: "act-test-001",
        input: {
            validated_plan: {
                objective: "Update configuration files",
                estimated_risk: "low",
                steps: [
                    makeStep({ step_id: 1, tool: "update_file", parameters: { file: "src/config.ts" } }),
                    makeStep({ step_id: 2, tool: "create_file", parameters: { file: "src/new-module.ts" } }),
                ],
            },
        },
    });

    const result = await actStage(execution);

    assert(result.nextStage === Stage.VERIFY, "Returns nextStage: VERIFY");
    assert(result.status === undefined || result.status !== ExecutionStatus.FAILED, "Status is not FAILED");
    assert(typeof result.output?.total_steps === "number" && result.output?.total_steps === 2, "Reports 2 total steps");
    assert(result.output?.steps_completed === 2, "Reports 2 steps completed");

    // Verify logs were written
    const logs = await executionLogRepository.readExecutionLogs("act-test-001");
    assert(logs.length === 2, "2 step logs written");
    assert(logs.every(l => l.status === "SUCCESS"), "All logs have status SUCCESS");
    assert(logs[0].step_number === 1 && logs[0].tool === "update_file", "Log 1 has correct step_number and tool");
    assert(logs[1].step_number === 2 && logs[1].tool === "create_file", "Log 2 has correct step_number and tool");
}

// ── TEST 2: Missing plan → FAILED ────────────────────────────────────

async function test_missing_plan_transitions_to_failed() {
    console.log("\nTest 2: Missing plan → nextStage: FAILED");

    const execution = makeExecution({
        execution_id: "act-test-002",
        input: {
            // No validated_plan or execution_plan key
            some_other_data: "irrelevant",
        },
    });

    const result = await actStage(execution);

    assert(result.nextStage === Stage.FAILED, "Returns nextStage: FAILED");
    assert(result.status === ExecutionStatus.FAILED, "Status is FAILED");
    assert(
        typeof result.output?.message === "string" &&
        (result.output.message as string).includes("no validated execution plan"),
        "Error message mentions missing plan"
    );

    // No logs should have been written for a missing plan
    const logs = await executionLogRepository.readExecutionLogs("act-test-002");
    assert(logs.length === 0, "No step logs written for missing plan");
}

// ── TEST 3: Null input → FAILED ──────────────────────────────────────

async function test_null_input_transitions_to_failed() {
    console.log("\nTest 3: Null input → nextStage: FAILED");

    const execution = makeExecution({
        execution_id: "act-test-003",
        input: undefined,
    });

    const result = await actStage(execution);

    assert(result.nextStage === Stage.FAILED, "Returns nextStage: FAILED for null input");
    assert(result.status === ExecutionStatus.FAILED, "Status is FAILED for null input");
}

// ── TEST 4: Tool failure mid-plan — fail fast ─────────────────────────

async function test_tool_failure_aborts_and_fails() {
    console.log("\nTest 4: Tool failure mid-plan → fail fast, nextStage: FAILED");

    // We simulate a failure by providing a tool that the executor does not recognise.
    // The constraint engine would normally block this, but we bypass it in this unit test
    // to exercise the ACT stage's failure-handling path directly.
    const execution = makeExecution({
        execution_id: "act-test-004",
        input: {
            validated_plan: {
                objective: "Mixed success/fail plan",
                estimated_risk: "low",
                steps: [
                    makeStep({ step_id: 1, tool: "update_file", parameters: { file: "src/a.ts" } }),
                    // Unknown tool — will fail in executor dispatch
                    makeStep({ step_id: 2, tool: "unknown_tool" as any, action: "This will fail" }),
                    // This step must NOT execute (fail fast)
                    makeStep({ step_id: 3, tool: "create_file", parameters: { file: "src/b.ts" } }),
                ],
            },
        },
    });

    const result = await actStage(execution);

    assert(result.nextStage === Stage.FAILED, "Returns nextStage: FAILED after tool failure");
    assert(result.status === ExecutionStatus.FAILED, "Status is FAILED");
    assert(result.output?.failed_step === 2, "Reports failed_step: 2");
    assert(result.output?.steps_completed === 1, "Reports 1 step completed before abort");

    // Logs for step 1 (SUCCESS) and step 2 (FAILED) must exist
    // Step 3 must NOT have a log entry (fail-fast abort)
    const logs = await executionLogRepository.readExecutionLogs("act-test-004");
    assert(logs.length === 2, "Exactly 2 logs written (step 1 success + step 2 failure)");
    assert(logs[0].status === "SUCCESS" && logs[0].step_number === 1, "Step 1 log: SUCCESS");
    assert(logs[1].status === "FAILED" && logs[1].step_number === 2, "Step 2 log: FAILED");
    assert(
        !logs.find(l => l.step_number === 3),
        "No log for step 3 (fail-fast abort respected)"
    );
}

// ── TEST 5: Log integrity — latency and timestamps present ────────────

async function test_log_integrity() {
    console.log("\nTest 5: Execution log integrity — latency and timestamps present");

    const execution = makeExecution({
        execution_id: "act-test-005",
        input: {
            validated_plan: {
                objective: "Single step plan",
                estimated_risk: "low",
                steps: [
                    makeStep({ step_id: 1, tool: "run_ci", parameters: { pipeline: "unit-tests" } }),
                ],
            },
        },
    });

    await actStage(execution);
    const logs = await executionLogRepository.readExecutionLogs("act-test-005");

    assert(logs.length === 1, "One log entry written");
    assert(typeof logs[0].latency_ms === "number" && logs[0].latency_ms >= 0, "latency_ms is a non-negative number");
    assert(typeof logs[0].log_timestamp === "string" && logs[0].log_timestamp.length > 0, "log_timestamp is present");
    assert(logs[0].tool === "run_ci", "log records correct tool name");
    assert(logs[0].execution_id === "act-test-005", "log records correct execution_id");
}

// ── RUN ALL TESTS ────────────────────────────────────────────────────

(async () => {
    try {
        await test_valid_plan_transitions_to_verify();
        await test_missing_plan_transitions_to_failed();
        await test_null_input_transitions_to_failed();
        await test_tool_failure_aborts_and_fails();
        await test_log_integrity();
    } catch (err: any) {
        console.error("\n[TEST RUNNER] Unexpected error:", err.message ?? err);
        failed++;
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

    if (failed > 0) {
        process.exit(1);
    }
})();
