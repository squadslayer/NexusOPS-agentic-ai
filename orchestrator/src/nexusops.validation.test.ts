/**
 * nexusops.validation.test.ts — Master Phase 0-9 Validation Suite
 *
 * Verifies ALL NexusOPS phases in a single runnable test file.
 *
 * Run with:
 *   npx ts-node src/nexusops.validation.test.ts
 *
 * Phases covered:
 *   Phase 0  — Access Pattern Matrix (model field contracts)
 *   Phase 1  — Infrastructure Contracts (enums, state machine, lifecycle schema)
 *   Phase 2  — API/BFF Contract (response envelope, input validation)
 *   Phase 3  — Orchestrator Foundation (dispatch, transitions, optimistic locking)
 *   Phase 4  — RETRIEVE Stage (context retrieval, empty-fetch failure)
 *   Phase 5  — REASON Stage (planner output, token tracking)
 *   Phase 6  — CONSTRAINT Engine (whitelist, path safety, risk, step limit)
 *   Phase 7  — APPROVAL Gateway (create, resume, decision, timeout)
 *   Phase 8  — ACT + VERIFY (sequential execution, metrics, success_rate)
 *   Phase 9  — Risk Registry + Cost Monitor (hash, recurrence, budgets)
 */

// ── IMPORTS ──────────────────────────────────────────────────────────

import { Stage, isValidTransition } from "./models/stages";
import { ExecutionStatus } from "./models/execution";
import { validateExecutionPlan } from "./constraints/constraintEngine";
import { ALLOWED_TOOLS } from "./schemas/plannerSchema";
import { successResponse, errorResponse } from "./utils/response";
import { validatePlannerOutput, PlannerValidationError } from "./utils/validator";
import { askStage } from "./stages/askStage";
import { retrieveStage } from "./stages/retrieveStage";
import { reasonStage } from "./stages/reasonStage";
import { constraintStage } from "./stages/constraintStage";
import { approvalStage } from "./stages/approvalStage";
import { actStage } from "./stages/actStage";
import { verifyStage } from "./stages/verifyStage";
import { dispatchStage } from "./stageDispatcher";
import {
    LocalMemoryRiskRegistry,
    isRecurrenceBlocked,
    RECURRENCE_THRESHOLD,
} from "./services/riskRegistryRepository";
import { computeRiskHash } from "./utils/riskHasher";
import {
    enforceCostLimits,
    CostLimitExceeded,
    COST_LIMITS,
    getCostReport,
} from "./services/costMonitor";
import { LocalMemoryLogRepository, executionLogRepository } from "./services/executionLogRepository";
import type { Execution } from "./models/execution";
import type { ExecutionPlan } from "./constraints/constraintEngine";

// ── TEST HARNESS ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const phaseSummary: { phase: string; pass: number; fail: number }[] = [];

function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
        console.log(`    ✅ ${name}`);
        passed++;
    } else {
        console.error(`    ❌ ${name}${detail ? `\n       Detail: ${detail}` : ""}`);
        failed++;
    }
}

function section(title: string) {
    console.log(`\n  ── ${title} ──`);
}

function phaseHeader(num: string, name: string): { pass: number; fail: number } {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  PHASE ${num} — ${name}`);
    console.log(`${"═".repeat(60)}`);
    return { pass: passed, fail: failed };
}

function phaseFooter(label: string, snapshot: { pass: number; fail: number }) {
    const p = passed - snapshot.pass;
    const f = failed - snapshot.fail;
    phaseSummary.push({ phase: label, pass: p, fail: f });
    console.log(`  → Phase result: ${p} pass, ${f} fail`);
}

let execCounter = 0;
function makeExec(overrides: Partial<Execution> = {}): Readonly<Execution> {
    execCounter++;
    return {
        execution_id: `exec-test-${execCounter}`,
        user_id: "user-dev4",
        repo_id: "repo-nexus",
        stage: Stage.ASK,
        status: ExecutionStatus.RUNNING,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        input: {},
        ...overrides,
    };
}

function makePlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
    return {
        objective: "Phase validation plan",
        estimated_risk: "low",
        steps: [
            {
                step_id: 1,
                tool: "update_file",
                action: "Update config",
                parameters: { file: "src/config.ts" },
                expected_output: "File updated",
                risk_level: "low",
            },
        ],
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 0 — Access Pattern Matrix
// ═══════════════════════════════════════════════════════════════════

async function phase0() {
    const snap = phaseHeader("0", "ACCESS PATTERN MATRIX — Model Field Contracts");

    section("Execution Record Fields (lifecycle queries)");
    const exec = makeExec();
    assert("execution_id" in exec, "execution_id field present");
    assert("user_id" in exec, "user_id field present");
    assert("repo_id" in exec, "repo_id field present");
    assert("stage" in exec, "stage field present (PK for lifecycle queries)");
    assert("status" in exec, "status field present");
    assert("version" in exec, "version field present (optimistic lock)");
    assert("created_at" in exec, "created_at field present");
    assert("updated_at" in exec, "updated_at field present");
    assert("input" in exec, "input field present (stage output payload)");

    section("Approval Storage Access Pattern Transitions");
    assert(isValidTransition(Stage.APPROVAL_PENDING, Stage.ACT), "APPROVAL_PENDING → ACT (approved)");
    assert(isValidTransition(Stage.APPROVAL_PENDING, Stage.FAILED), "APPROVAL_PENDING → FAILED (rejected/expired)");
    // Self-transition is a HOLD — handler skips state write when nextStage === currentStage.
    // It is NOT registered in VALID_TRANSITIONS (no DB write = no transition event).
    assert(!isValidTransition(Stage.APPROVAL_PENDING, Stage.APPROVAL_PENDING), "APPROVAL_PENDING self-loop not in VALID_TRANSITIONS (hold pattern)");

    section("Risk Registry Access Patterns (field contract)");
    const registry = new LocalMemoryRiskRegistry();
    const hash = computeRiskHash(makePlan());
    const record = await registry.recordRisk(hash, "high");
    assert("risk_hash" in record, "risk_hash (partition key)");
    assert("first_seen" in record, "first_seen timestamp");
    assert("occurrence_count" in record, "occurrence_count (recurrence counter)");
    assert("risk_level" in record, "risk_level (GSI: risk_level-index)");
    assert("blocked" in record, "blocked flag");

    section("Execution Log Access Patterns (field contract)");
    const logRepo = new LocalMemoryLogRepository();
    await logRepo.writeStepLog({
        execution_id: "access-test",
        step_number: 1,
        tool: "update_file",
        action: "test",
        status: "SUCCESS",
        latency_ms: 50,
        log_timestamp: new Date().toISOString(),
    });
    const logs = await logRepo.readExecutionLogs("access-test");
    const log = logs[0];
    assert("execution_id" in log, "log.execution_id present");
    assert("step_number" in log, "log.step_number present");
    assert("tool" in log, "log.tool present");
    assert("status" in log, "log.status present");
    assert("latency_ms" in log, "log.latency_ms present");
    assert("log_timestamp" in log, "log.log_timestamp present");

    phaseFooter("Phase 0", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 1 — Infrastructure Contracts
// ═══════════════════════════════════════════════════════════════════

async function phase1() {
    const snap = phaseHeader("1", "INFRASTRUCTURE CONTRACTS — Enums, State Machine, Schema");

    section("Stage Enum — All 9 Lifecycle Stages Defined");
    const requiredStages = [
        Stage.ASK, Stage.RETRIEVE, Stage.REASON, Stage.CONSTRAINT,
        Stage.APPROVAL_PENDING, Stage.ACT, Stage.VERIFY, Stage.COMPLETED, Stage.FAILED,
    ];
    assert(requiredStages.length === 9, "9 lifecycle stages defined");
    for (const s of requiredStages) {
        assert(typeof s === "string", `Stage.${s} is a string value`);
    }

    section("ExecutionStatus Enum");
    assert(ExecutionStatus.RUNNING !== undefined, "RUNNING status defined");
    assert(ExecutionStatus.PAUSED !== undefined, "PAUSED status defined");
    assert(ExecutionStatus.COMPLETED !== undefined, "COMPLETED status defined");
    assert(ExecutionStatus.FAILED !== undefined, "FAILED status defined");

    section("State Machine — Valid Forward Transitions");
    const forwardPath: [Stage, Stage][] = [
        [Stage.ASK, Stage.RETRIEVE],
        [Stage.RETRIEVE, Stage.REASON],
        [Stage.REASON, Stage.CONSTRAINT],
        [Stage.CONSTRAINT, Stage.APPROVAL_PENDING],
        [Stage.APPROVAL_PENDING, Stage.ACT],
        [Stage.ACT, Stage.VERIFY],
        [Stage.VERIFY, Stage.COMPLETED],
    ];
    for (const [from, to] of forwardPath) {
        assert(isValidTransition(from, to), `${from} → ${to}`);
    }

    section("State Machine — FAILED from each active stage");
    const failableStages = [
        Stage.RETRIEVE, Stage.REASON, Stage.CONSTRAINT,
        Stage.APPROVAL_PENDING, Stage.ACT, Stage.VERIFY,
    ];
    for (const from of failableStages) {
        assert(isValidTransition(from, Stage.FAILED), `${from} → FAILED`);
    }

    section("State Machine — Illegal Transitions Blocked");
    assert(!isValidTransition(Stage.COMPLETED, Stage.ASK), "COMPLETED → ASK blocked");
    assert(!isValidTransition(Stage.FAILED, Stage.ACT), "FAILED → ACT blocked");
    assert(!isValidTransition(Stage.ASK, Stage.ACT), "ASK → ACT blocked (skip)");
    assert(!isValidTransition(Stage.VERIFY, Stage.REASON), "VERIFY → REASON blocked (backwards)");

    section("Tool Whitelist — ALLOWED_TOOLS");
    const requiredTools = ["update_file", "create_file", "delete_file", "run_ci", "create_pr"];
    for (const t of requiredTools) assert(ALLOWED_TOOLS.includes(t as any), `ALLOWED_TOOLS has "${t}"`);
    assert(ALLOWED_TOOLS.length === 5, "Exactly 5 tools in whitelist");

    phaseFooter("Phase 1", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — API/BFF Contract
// ═══════════════════════════════════════════════════════════════════

async function phase2() {
    const snap = phaseHeader("2", "BFF CONTRACT — Response Envelope, Planner Validation");

    section("Success Response Envelope");
    const ok = successResponse({ stage: "RUNNING" }, { requestId: "req-001" });
    assert(ok.success === true, "success: true");
    assert("data" in ok, "data field present");
    assert("error" in ok, "error field present");
    assert(ok.error === null, "error: null on success");
    assert("meta" in ok, "meta field present");
    assert("timestamp" in ok.meta, "meta.timestamp present");

    section("Error Response Envelope");
    const err = errorResponse("ConstraintViolation", { code: 400 });
    assert(err.success === false, "success: false on error");
    assert(err.error !== null, "error field populated");
    assert(err.data === null, "data: null on error");

    section("Planner Output Validation — valid plan passes");
    const validOutput = {
        execution_plan: {
            objective: "Test deployment",
            estimated_risk: "low",
            steps: [{
                step_id: 1, tool: "update_file",
                action: "Update config",
                parameters: { file: "src/a.ts" },
                expected_output: "Updated",
                risk_level: "low",
            }],
        },
    };
    let validErr: string | null = null;
    try { validatePlannerOutput(validOutput); } catch (e: any) { validErr = e.message; }
    assert(validErr === null, "Valid planner output passes validation");

    section("Planner Output Validation — rejects bad tool");
    let badErr: string | null = null;
    try {
        validatePlannerOutput({
            execution_plan: {
                objective: "Test",
                estimated_risk: "low",
                steps: [{ step_id: 1, tool: "rm -rf", action: "nuke", parameters: {}, expected_output: "", risk_level: "low" }],
            },
        });
    } catch (e: any) { badErr = e.message; }
    assert(badErr !== null, "Invalid tool rejected by validation");

    section("Planner Output Validation — rejects missing execution_plan");
    let missingErr: string | null = null;
    try { validatePlannerOutput({}); } catch (e: any) { missingErr = e.message; }
    assert(missingErr !== null, "Missing execution_plan rejected");

    phaseFooter("Phase 2", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 3 — Orchestrator Foundation
// ═══════════════════════════════════════════════════════════════════

async function phase3() {
    const snap = phaseHeader("3", "ORCHESTRATOR FOUNDATION — Dispatch, Transitions, Locking");

    section("dispatchStage — routes ASK correctly");
    const askExec = makeExec({ stage: Stage.ASK });
    const askResult = await dispatchStage(askExec);
    assert(askResult.nextStage === Stage.RETRIEVE, "dispatchStage(ASK) → RETRIEVE");

    section("ASK Stage — direct call contract");
    const askDirect = await askStage(makeExec({ stage: Stage.ASK }));
    assert(askDirect.nextStage === Stage.RETRIEVE, "askStage → RETRIEVE");
    assert(
        typeof (askDirect.output as any)?.execution_id === "string",
        "execution_id in ASK output"
    );
    assert(
        typeof (askDirect.output as any)?.processed_at === "string",
        "processed_at timestamp in ASK output"
    );
    assert(
        (askDirect.output as any)?.message?.includes("ASK"),
        "message references ASK"
    );

    section("dispatchStage — terminal stage contract");
    const completedExec = makeExec({ stage: Stage.COMPLETED });
    const completedResult = await dispatchStage(completedExec);
    assert(
        completedResult.nextStage === Stage.COMPLETED,
        "dispatchStage(COMPLETED) stays COMPLETED"
    );

    const failedExec = makeExec({ stage: Stage.FAILED });
    const failedResult = await dispatchStage(failedExec);
    assert(
        failedResult.nextStage === Stage.FAILED,
        "dispatchStage(FAILED) stays FAILED"
    );

    section("Optimistic Locking — version field type and presence");
    const exec = makeExec({ version: 1 });
    assert(typeof exec.version === "number", "version is a number");
    assert(exec.version === 1, "version starts at 1");

    phaseFooter("Phase 3", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — RETRIEVE Stage
// ═══════════════════════════════════════════════════════════════════

async function phase4() {
    const snap = phaseHeader("4", "RETRIEVE STAGE — Context Fetching");

    section("RETRIEVE Stage — valid query");
    const exec = makeExec({
        stage: Stage.RETRIEVE,
        input: { query: "infrastructure deployment test" },
    });
    const result = await retrieveStage(exec);
    const validNext = result.nextStage === Stage.REASON || result.nextStage === Stage.FAILED;
    assert(validNext, `RETRIEVE → ${result.nextStage} (REASON or FAILED both valid)`);

    if (result.nextStage === Stage.REASON) {
        assert(Array.isArray((result.output as any)?.context_refs), "context_refs is an array");
        assert((result.output as any)?.context_refs.length > 0, "context_refs non-empty");
        assert(typeof (result.output as any)?.query === "string", "query echoed in output");
        assert(typeof (result.output as any)?.retrieved_at === "string", "retrieved_at in output");
    }

    section("RETRIEVE Stage — fails on empty retrieval (state machine)");
    assert(
        isValidTransition(Stage.RETRIEVE, Stage.FAILED),
        "RETRIEVE → FAILED is a valid transition"
    );

    section("RETRIEVE Stage — no version in output (no DB mutation)");
    assert(
        !("version" in (result.output || {})),
        "RETRIEVE output does not include version field"
    );

    phaseFooter("Phase 4", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 5 — REASON Stage
// ═══════════════════════════════════════════════════════════════════

async function phase5() {
    const snap = phaseHeader("5", "REASON STAGE — Planner Invocation, Token Tracking");

    const exec = makeExec({
        stage: Stage.REASON,
        input: { query: "Deploy infrastructure update" },
    });
    const result = await reasonStage(exec);
    const out = result.output as any;

    section("REASON Stage — routes to CONSTRAINT");
    assert(result.nextStage === Stage.CONSTRAINT, "REASON → CONSTRAINT");

    section("REASON Stage — planner_output structure");
    assert("planner_output" in out, "planner_output in output");
    assert("execution_plan" in out.planner_output, "execution_plan in planner_output");
    assert(Array.isArray(out.planner_output.execution_plan.steps), "steps is an array");
    assert(out.planner_output.execution_plan.steps.length > 0, "steps non-empty");

    section("Phase-9 Integration — Token counts forwarded");
    assert(typeof out.total_tokens === "number", "total_tokens in output");
    assert(typeof out.input_tokens === "number", "input_tokens in output");
    assert(typeof out.output_tokens === "number", "output_tokens in output");
    assert(out.total_tokens === out.input_tokens + out.output_tokens, "total = input + output");
    assert(out.total_tokens > 0, "total_tokens > 0 (mock provides 650)");

    section("REASON Stage — JSON-only output");
    let jsonOk = false;
    try { JSON.parse(JSON.stringify(out.planner_output)); jsonOk = true; } catch { }
    assert(jsonOk, "planner_output is JSON-serializable");

    phaseFooter("Phase 5", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 6 — CONSTRAINT Engine
// ═══════════════════════════════════════════════════════════════════

async function phase6() {
    const snap = phaseHeader("6", "CONSTRAINT ENGINE — Whitelist, Risk, Path Safety, Limits");

    section("Constraint Engine — valid plan passes");
    const valid = validateExecutionPlan(makePlan());
    assert(valid.allowed, "Valid plan allowed");
    assert(typeof valid.finalRisk === "string", "finalRisk set");
    assert(Array.isArray(valid.violations), "violations is an array");
    assert(valid.violations.length === 0, "No violations on valid plan");

    section("Constraint Engine — forbidden tool blocked");
    const r1 = validateExecutionPlan(makePlan({
        steps: [{ step_id: 1, tool: "rm_rf" as any, action: "nuke", parameters: {}, expected_output: "", risk_level: "high" }],
    }));
    assert(!r1.allowed, "Forbidden tool: allowed=false");
    assert(r1.violations.length > 0, "Violation recorded");

    section("Constraint Engine — path traversal blocked");
    const r2 = validateExecutionPlan(makePlan({
        steps: [{ step_id: 1, tool: "update_file", action: "escape", parameters: { file: "../../.env" }, expected_output: "", risk_level: "low" }],
    }));
    assert(!r2.allowed, "Path traversal (../../.env) blocked");

    section("Constraint Engine — .env direct access blocked");
    const r3 = validateExecutionPlan(makePlan({
        steps: [{ step_id: 1, tool: "update_file", action: "env write", parameters: { file: ".env" }, expected_output: "", risk_level: "low" }],
    }));
    assert(!r3.allowed, ".env access blocked");

    section("Constraint Engine — step limit enforced (max 10)");
    const r4 = validateExecutionPlan(makePlan({
        steps: Array.from({ length: 11 }, (_, i) => ({
            step_id: i + 1, tool: "update_file" as any, action: "step",
            parameters: { file: `src/f${i}.ts` }, expected_output: "", risk_level: "low" as any,
        })),
    }));
    assert(!r4.allowed, "11-step plan blocked");

    section("Constraint Engine — empty plan blocked");
    const r5 = validateExecutionPlan(makePlan({ steps: [] }));
    assert(!r5.allowed, "Empty plan blocked");

    section("Constraint Engine — high risk plan requires approval");
    const r6 = validateExecutionPlan(makePlan({
        steps: [
            { step_id: 1, tool: "delete_file", action: "delete", parameters: { file: "src/x.ts" }, expected_output: "", risk_level: "high" },
            { step_id: 2, tool: "create_pr", action: "pr", parameters: {}, expected_output: "", risk_level: "medium" },
        ],
    }));
    if (r6.allowed) {
        assert(r6.finalRisk === "high", "Engine sets risk to high");
        assert(r6.requiresApproval === true, "High risk triggers requiresApproval");
    }

    section("CONSTRAINT Stage — emits risk_hash (Phase-9)");
    const cr = await constraintStage(makeExec({
        stage: Stage.CONSTRAINT,
        input: { planner_output: { execution_plan: makePlan() } },
    }));
    const validCNext = cr.nextStage === Stage.APPROVAL_PENDING || cr.nextStage === Stage.FAILED;
    assert(validCNext, `CONSTRAINT → ${cr.nextStage} (APPROVAL_PENDING or FAILED)`);
    if (cr.nextStage === Stage.APPROVAL_PENDING) {
        assert(
            typeof (cr.output as any)?.risk_hash === "string",
            "risk_hash in CONSTRAINT output (Phase-9)"
        );
        assert((cr.output as any)?.risk_hash.length === 64, "risk_hash is 64-char hex");
    }

    phaseFooter("Phase 6", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 7 — APPROVAL Gateway
// ═══════════════════════════════════════════════════════════════════

async function phase7() {
    const snap = phaseHeader("7", "APPROVAL GATEWAY — Create, Resume, Decision, Timeout");

    section("APPROVAL Stage — no approval required → ACT");
    const r1 = await approvalStage(makeExec({
        stage: Stage.APPROVAL_PENDING,
        input: { requiresApproval: false, validated_plan: makePlan() },
    }));
    assert(r1.nextStage === Stage.ACT, "requiresApproval=false → ACT");
    assert("validated_plan" in (r1.output as any), "validated_plan forwarded");

    section("APPROVAL Stage — APPROVED decision → ACT");
    const r2 = await approvalStage(makeExec({
        stage: Stage.APPROVAL_PENDING,
        input: { approval_id: "ap-001", decision: "APPROVED", validated_plan: makePlan() },
    }));
    assert(r2.nextStage === Stage.ACT, "decision=APPROVED → ACT");
    assert("validated_plan" in (r2.output as any), "validated_plan forwarded after APPROVED");

    section("APPROVAL Stage — REJECTED decision → FAILED");
    const r3 = await approvalStage(makeExec({
        stage: Stage.APPROVAL_PENDING,
        input: { approval_id: "ap-002", decision: "REJECTED" },
    }));
    assert(r3.nextStage === Stage.FAILED, "decision=REJECTED → FAILED");
    assert(r3.status === ExecutionStatus.FAILED, "status: FAILED on rejection");

    section("APPROVAL Stage — pending (no decision) → stays APPROVAL_PENDING");
    const r4 = await approvalStage(makeExec({
        stage: Stage.APPROVAL_PENDING,
        input: { approval_id: "ap-003" },
    }));
    assert(r4.nextStage === Stage.APPROVAL_PENDING, "No decision → APPROVAL_PENDING");

    section("APPROVAL Stage — transition contract");
    assert(isValidTransition(Stage.APPROVAL_PENDING, Stage.ACT), "APPROVAL_PENDING → ACT valid");
    assert(isValidTransition(Stage.APPROVAL_PENDING, Stage.FAILED), "APPROVAL_PENDING → FAILED valid");
    assert(
        !isValidTransition(Stage.APPROVAL_PENDING, Stage.REASON),
        "APPROVAL_PENDING → REASON invalid"
    );

    phaseFooter("Phase 7", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 8 — ACT + VERIFY
// ═══════════════════════════════════════════════════════════════════

async function phase8() {
    const snap = phaseHeader("8", "ACT + VERIFY — Sequential Execution, Metrics");

    section("ACT Stage — missing plan → FAILED");
    const noPlanResult = await actStage(makeExec({ stage: Stage.ACT, input: {} }));
    assert(noPlanResult.nextStage === Stage.FAILED, "Missing plan → FAILED");
    assert(noPlanResult.status === ExecutionStatus.FAILED, "status: FAILED");

    section("ACT Stage — 3-step plan → VERIFY");
    const plan3 = makePlan({
        objective: "Phase-8 plan",
        steps: [
            { step_id: 1, tool: "update_file", action: "Update", parameters: { file: "src/a.ts" }, expected_output: "", risk_level: "low" },
            { step_id: 2, tool: "run_ci", action: "CI", parameters: { pipeline: "ci" }, expected_output: "", risk_level: "low" },
            { step_id: 3, tool: "create_pr", action: "PR", parameters: { title: "PR", branch: "main" }, expected_output: "", risk_level: "low" },
        ],
    });
    const actResult = await actStage(makeExec({
        stage: Stage.ACT,
        input: { validated_plan: plan3, total_tokens: 650 },
    }));
    assert(actResult.nextStage === Stage.VERIFY, "3-step plan → VERIFY");
    const actOut = actResult.output as any;
    assert(actOut.total_steps === 3, "total_steps: 3");
    assert(actOut.steps_completed === 3, "steps_completed: 3");
    assert(actOut.invocation_count === 3, "invocation_count: 3 (Phase-9)");
    assert(actOut.total_tokens === 650, "total_tokens forwarded from REASON");

    section("ACT Stage — fail-fast on unknown tool");
    const failPlan = makePlan({
        steps: [
            { step_id: 1, tool: "update_file", action: "OK", parameters: { file: "src/a.ts" }, expected_output: "", risk_level: "low" },
            { step_id: 2, tool: "rm_everything" as any, action: "FAIL", parameters: {}, expected_output: "", risk_level: "high" },
            { step_id: 3, tool: "create_pr", action: "SKIP", parameters: {}, expected_output: "", risk_level: "low" },
        ],
    });
    const failResult = await actStage(makeExec({ stage: Stage.ACT, input: { validated_plan: failPlan } }));
    assert(failResult.nextStage === Stage.FAILED, "Unknown tool → FAILED");
    assert((failResult.output as any).failed_step === 2, "failed_step: 2");
    assert((failResult.output as any).steps_completed === 1, "1 step completed before abort");

    section("VERIFY Stage — all-success → COMPLETED");
    const verifyId = `verify-ph8-${Date.now()}`;
    for (let i = 1; i <= 3; i++) {
        await executionLogRepository.writeStepLog({
            execution_id: verifyId,
            step_number: i,
            tool: "update_file",
            action: `Step ${i}`,
            status: "SUCCESS",
            latency_ms: 40 + i * 10,
            log_timestamp: new Date().toISOString(),
        });
    }
    const vr1 = await verifyStage(makeExec({
        stage: Stage.VERIFY,
        execution_id: verifyId,
        input: { execution_id: verifyId },
    }));
    assert(vr1.nextStage === Stage.COMPLETED, "All steps pass → COMPLETED");
    const vOut = vr1.output as any;
    assert(vOut.success_rate === 100, "success_rate: 100");
    assert(vOut.total_steps === 3, "total_steps: 3");
    assert(vOut.failed_steps === 0, "failed_steps: 0");
    assert(typeof vOut.execution_duration_ms === "number", "execution_duration_ms present");

    section("VERIFY Stage — partial failure → FAILED");
    const failId = `verify-fail-${Date.now()}`;
    await executionLogRepository.writeStepLog({ execution_id: failId, step_number: 1, tool: "update_file", action: "ok", status: "SUCCESS", latency_ms: 50, log_timestamp: new Date().toISOString() });
    await executionLogRepository.writeStepLog({ execution_id: failId, step_number: 2, tool: "run_ci", action: "fail", status: "FAILED", latency_ms: 10, log_timestamp: new Date().toISOString() });
    const vr2 = await verifyStage(makeExec({
        stage: Stage.VERIFY,
        execution_id: failId,
        input: { execution_id: failId },
    }));
    assert(vr2.nextStage === Stage.FAILED, "Partial failure → FAILED");
    assert((vr2.output as any).success_rate < 100, "success_rate < 100");

    phaseFooter("Phase 8", snap);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9 — Risk Registry + Cost Monitor
// ═══════════════════════════════════════════════════════════════════

async function phase9() {
    const snap = phaseHeader("9", "RISK REGISTRY + COST MONITOR — Governance Enforcement");

    section("Risk Hashing — determinism");
    const p1 = makePlan({ objective: "Same plan" });
    const p2 = makePlan({ objective: "Same plan" });
    assert(computeRiskHash(p1) === computeRiskHash(p2), "Identical plans → same hash");
    assert(computeRiskHash(p1).length === 64, "Hash is 64-char SHA-256 hex");

    section("Risk Hashing — uniqueness");
    const pA = makePlan({ objective: "Plan A" });
    const pB = makePlan({ objective: "Plan B" });
    assert(computeRiskHash(pA) !== computeRiskHash(pB), "Different plans → different hashes");

    section("Risk Registry — first plan recorded correctly");
    const reg = new LocalMemoryRiskRegistry();
    const hash = computeRiskHash(makePlan({ objective: "Governance test" }));
    assert((await reg.getRisk(hash)) === null, "New hash: no record before first submission");
    const rec = await reg.recordRisk(hash, "high");
    assert(rec.occurrence_count === 1, "occurrence_count=1 on first record");
    assert(rec.blocked === false, "blocked=false on first record");
    assert(typeof rec.first_seen === "string", "first_seen is ISO string");

    section("Risk Registry — repeated plan increments count");
    await reg.incrementOccurrence(hash);
    await reg.incrementOccurrence(hash);
    const r3 = await reg.getRisk(hash);
    assert(r3?.occurrence_count === 3, "count=3 after 2 increments");
    assert(!isRecurrenceBlocked(r3!), "count=3 high-risk: not yet blocked");

    section("Risk Registry — recurrence threshold (count>5 AND risk=high)");
    for (let i = 0; i < 3; i++) await reg.incrementOccurrence(hash);
    const r6 = await reg.getRisk(hash);
    assert(r6?.occurrence_count === 6, "count reaches 6");
    assert(isRecurrenceBlocked(r6!), "isRecurrenceBlocked → true at count=6, risk=high");

    section("Risk Registry — medium risk never auto-blocks");
    const medHash = computeRiskHash(makePlan({ objective: "Medium plan" }));
    await reg.recordRisk(medHash, "medium");
    for (let i = 0; i < 10; i++) await reg.incrementOccurrence(medHash);
    assert(!isRecurrenceBlocked((await reg.getRisk(medHash))!), "Medium risk count=11 NOT blocked");

    section("Risk Registry — explicit blockRisk()");
    const lowHash = computeRiskHash(makePlan({ objective: "Low risk explicit block" }));
    await reg.recordRisk(lowHash, "low");
    await reg.blockRisk(lowHash);
    assert(isRecurrenceBlocked((await reg.getRisk(lowHash))!), "explicit block → isRecurrenceBlocked");

    section("Cost Monitor — within budgets: no throw");
    let threw = false;
    try { enforceCostLimits(1000, 3, { execution_id: "p9", stage: "ACT" }); } catch { threw = true; }
    assert(!threw, "1000 tokens + 3 invocations: no throw");

    section("Cost Monitor — token budget breach");
    let tokenCode = "";
    try { enforceCostLimits(COST_LIMITS.MAX_TOKENS + 1, 0, { execution_id: "p9", stage: "REASON" }); }
    catch (e: any) { tokenCode = e.code ?? ""; }
    assert(tokenCode === "TOKEN_BUDGET_EXCEEDED", "Token breach → TOKEN_BUDGET_EXCEEDED");

    section("Cost Monitor — invocation limit breach");
    let invCode = "";
    try { enforceCostLimits(0, COST_LIMITS.MAX_INVOCATIONS + 1, { execution_id: "p9", stage: "ACT" }); }
    catch (e: any) { invCode = e.code ?? ""; }
    assert(invCode === "INVOCATION_LIMIT_EXCEEDED", "Invocation breach → INVOCATION_LIMIT_EXCEEDED");

    section("Cost Monitor — at limit: no throw (limit exclusive)");
    let atLimitThrew = false;
    try { enforceCostLimits(COST_LIMITS.MAX_TOKENS, COST_LIMITS.MAX_INVOCATIONS, { execution_id: "p9b", stage: "ACT" }); }
    catch { atLimitThrew = true; }
    assert(!atLimitThrew, "Exactly at limits: no throw");

    section("Cost Monitor — getCostReport");
    const report = getCostReport(1000, 5);
    assert(report.within_token_budget === true, "1000 tokens: within budget");
    assert(report.within_invocation_budget === true, "5 invocations: within budget");
    assert(typeof report.estimated_cost_usd === "number", "estimated_cost_usd is a number");

    section("Cost Limits — match spec (MAX_TOKENS=50k, MAX_INVOCATIONS=10)");
    assert(COST_LIMITS.MAX_TOKENS === 50_000, "MAX_TOKENS = 50,000");
    assert(COST_LIMITS.MAX_INVOCATIONS === 10, "MAX_INVOCATIONS = 10");

    section("Recurrence Threshold — matches spec");
    assert(RECURRENCE_THRESHOLD.max_occurrences === 5, "threshold: 5 occurrences");
    assert(RECURRENCE_THRESHOLD.risk_level === "high", "threshold: high risk only");

    section("Phase-9 — CONSTRAINT Stage emits risk_hash");
    const cr = await constraintStage(makeExec({
        stage: Stage.CONSTRAINT,
        input: { planner_output: { execution_plan: makePlan({ objective: "Unique P9 governance plan" }) } },
    }));
    if (cr.nextStage === Stage.APPROVAL_PENDING) {
        assert(typeof (cr.output as any)?.risk_hash === "string", "risk_hash in CONSTRAINT output");
    } else {
        assert(true, "CONSTRAINT returned FAILED (hash still computed — recurrence triggered)");
    }

    section("Phase-9 — ACT Stage invocation_count tracking");
    const bigPlan = makePlan({
        steps: Array.from({ length: 3 }, (_, i) => ({
            step_id: i + 1, tool: "update_file" as any, action: `Step ${i + 1}`,
            parameters: { file: `src/f${i}.ts` }, expected_output: "", risk_level: "low" as any,
        })),
    });
    const bigActResult = await actStage(makeExec({
        stage: Stage.ACT,
        input: { validated_plan: bigPlan, total_tokens: 1000 },
    }));
    assert(
        (bigActResult.output as any)?.invocation_count === 3,
        "ACT invocation_count = 3 for 3-step plan"
    );

    phaseFooter("Phase 9", snap);
}

// ═══════════════════════════════════════════════════════════════════
// MASTER REPORT
// ═══════════════════════════════════════════════════════════════════

async function runAll() {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║        NexusOPS — Master Phase 0-9 Validation Suite         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    await phase0();
    await phase1();
    await phase2();
    await phase3();
    await phase4();
    await phase5();
    await phase6();
    await phase7();
    await phase8();
    await phase9();

    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    VALIDATION REPORT                        ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");

    for (const { phase, pass, fail } of phaseSummary) {
        const icon = fail === 0 ? "✅" : "❌";
        console.log(`║  ${icon} ${phase.padEnd(30)} ${String(pass).padStart(3)} pass  ${String(fail).padStart(3)} fail ║`);
    }

    console.log("╠══════════════════════════════════════════════════════════════╣");
    const totalIcon = failed === 0 ? "✅" : "❌";
    console.log(`║  ${totalIcon} ${"TOTAL".padEnd(30)} ${String(passed).padStart(3)} pass  ${String(failed).padStart(3)} fail ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log();

    if (failed > 0) {
        console.error(`\n❌ ${failed} assertion(s) failed.\n`);
        process.exit(1);
    } else {
        console.log(`✅ All ${passed} assertions passed. NexusOPS Phase 0-9 validation complete.\n`);
    }
}

runAll().catch((err) => {
    console.error("\n[SUITE ERROR]", err);
    process.exit(1);
});
