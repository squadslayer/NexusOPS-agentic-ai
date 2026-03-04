/**
 * riskRegistryRepository.test.ts — Governance unit tests (Phase-9).
 *
 * Covers all 5 Dev-4 governance validation scenarios from the Phase-9 spec.
 * Runs without Jest: npx ts-node src/services/riskRegistryRepository.test.ts
 *
 * Uses isolated repository instances per test to prevent cross-test pollution.
 */

import { LocalMemoryRiskRegistry, isRecurrenceBlocked, RECURRENCE_THRESHOLD } from "./riskRegistryRepository";
import { computeRiskHash } from "../utils/riskHasher";
import { enforceCostLimits, CostLimitExceeded, COST_LIMITS } from "./costMonitor";
import type { ExecutionPlan } from "../constraints/constraintEngine";

// ── HELPERS ──────────────────────────────────────────────────────────

console.log("=== Phase-9 Governance Unit Tests ===\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
        failed++;
    }
}

function makePlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
    return {
        objective: "Update deployment config",
        estimated_risk: "high",
        steps: [
            {
                step_id: 1,
                tool: "update_file",
                action: "Update config file",
                parameters: { file: "src/config.ts" },
                expected_output: "Config updated",
                risk_level: "high",
            },
        ],
        ...overrides,
    };
}

// ── TEST 1: First risky plan is recorded ─────────────────────────────

async function test_first_risky_plan_recorded() {
    console.log("Test 1: First risky plan → recorded in registry (count=1)");

    const registry = new LocalMemoryRiskRegistry();
    const plan = makePlan();
    const hash = computeRiskHash(plan);

    // Nothing recorded yet
    const before = await registry.getRisk(hash);
    assert(before === null, "No record before first submission");

    // Record it
    const record = await registry.recordRisk(hash, "high");
    assert(record.occurrence_count === 1, "occurrence_count starts at 1");
    assert(record.risk_level === "high", "risk_level stored correctly");
    assert(record.blocked === false, "blocked starts as false");
    assert(typeof record.first_seen === "string", "first_seen is an ISO string");

    // Verify it's retrievable
    const retrieved = await registry.getRisk(hash);
    assert(retrieved !== null, "Record is retrievable after creation");
    assert(retrieved?.risk_hash === hash, "Retrieved hash matches");
}

// ── TEST 2: Repeated plan increments occurrence count ─────────────────

async function test_repeated_plan_increments_count() {
    console.log("\nTest 2: Same plan submitted twice → occurrence count increments");

    const registry = new LocalMemoryRiskRegistry();
    const plan = makePlan({ objective: "Repeated plan" });
    const hash = computeRiskHash(plan);

    await registry.recordRisk(hash, "medium");
    const after1 = await registry.incrementOccurrence(hash);
    assert(after1.occurrence_count === 2, "count is 2 after first increment");

    const after2 = await registry.incrementOccurrence(hash);
    assert(after2.occurrence_count === 3, "count is 3 after second increment");
}

// ── TEST 3: Different plans produce different hashes ──────────────────

async function test_different_plans_have_different_hashes() {
    console.log("\nTest 3: Different plans → different risk hashes");

    const planA = makePlan({ objective: "Plan A" });
    const planB = makePlan({ objective: "Plan B" });

    const hashA = computeRiskHash(planA);
    const hashB = computeRiskHash(planB);

    assert(hashA !== hashB, "Different plans produce different hashes");
    assert(hashA.length === 64, "Hash A is 64-character hex");
    assert(hashB.length === 64, "Hash B is 64-character hex");
}

// ── TEST 4: Identical plans produce identical hashes ──────────────────

async function test_identical_plans_produce_same_hash() {
    console.log("\nTest 4: Identical plans → same hash (determinism)");

    const plan1 = makePlan();
    const plan2 = makePlan(); // Same content

    const hash1 = computeRiskHash(plan1);
    const hash2 = computeRiskHash(plan2);

    assert(hash1 === hash2, "Identical plans produce identical hashes");
}

// ── TEST 5: Recurrence threshold blocks execution ─────────────────────

async function test_recurrence_threshold_blocks_high_risk_plan() {
    console.log("\nTest 5: Recurrence threshold exceeded → execution blocked");

    const registry = new LocalMemoryRiskRegistry();
    const plan = makePlan({ objective: "High risk repeated plan" });
    const hash = computeRiskHash(plan);

    // Record once, then increment 5 more times (total count = 6)
    await registry.recordRisk(hash, "high");
    for (let i = 0; i < 5; i++) {
        await registry.incrementOccurrence(hash);
    }

    const record = await registry.getRisk(hash);
    assert(record !== null, "Record exists");
    assert(record!.occurrence_count === 6, `occurrence_count is 6 (got ${record!.occurrence_count})`);

    // isRecurrenceBlocked should return true (count > 5 AND risk=high)
    const blocked = isRecurrenceBlocked(record!);
    assert(blocked === true, "isRecurrenceBlocked returns true at count=6, risk=high");

    // Medium risk plan with same count should NOT be blocked
    const mediumPlan = makePlan({ objective: "Medium risk repeated plan" });
    const mediumHash = computeRiskHash(mediumPlan);
    await registry.recordRisk(mediumHash, "medium");
    for (let i = 0; i < 5; i++) {
        await registry.incrementOccurrence(mediumHash);
    }
    const mediumRecord = await registry.getRisk(mediumHash);
    assert(
        !isRecurrenceBlocked(mediumRecord!),
        "Medium risk plan with count=6 is NOT blocked (only high risk triggers)"
    );
}

// ── TEST 6: Explicit blockRisk overrides recurrence check ────────────

async function test_explicit_block_prevents_execution() {
    console.log("\nTest 6: blockRisk() → isRecurrenceBlocked returns true immediately");

    const registry = new LocalMemoryRiskRegistry();
    const plan = makePlan({ objective: "Low risk but explicitly blocked" });
    const hash = computeRiskHash(plan);

    await registry.recordRisk(hash, "low");
    const before = await registry.getRisk(hash);
    assert(!isRecurrenceBlocked(before!), "Not blocked before explicit block");

    await registry.blockRisk(hash);
    const after = await registry.getRisk(hash);
    assert(isRecurrenceBlocked(after!), "Blocked after explicit blockRisk()");
    assert(after!.blocked === true, "blocked flag is true");
}

// ── TEST 7: Token budget exceeded → CostLimitExceeded thrown ─────────

async function test_token_budget_exceeded() {
    console.log("\nTest 7: Token budget exceeded → CostLimitExceeded thrown");

    let caught = false;
    let errorCode = "";

    try {
        enforceCostLimits(COST_LIMITS.MAX_TOKENS + 1, 0, {
            execution_id: "gov-test-007",
            stage: "REASON",
        });
    } catch (err) {
        if (err instanceof CostLimitExceeded) {
            caught = true;
            errorCode = err.code;
        }
    }

    assert(caught, "CostLimitExceeded is thrown when tokens exceed MAX_TOKENS");
    assert(errorCode === "TOKEN_BUDGET_EXCEEDED", `Error code is TOKEN_BUDGET_EXCEEDED (got: ${errorCode})`);

    // Exactly at limit should NOT throw
    let atLimitThrew = false;
    try {
        enforceCostLimits(COST_LIMITS.MAX_TOKENS, 0, {
            execution_id: "gov-test-007b",
            stage: "REASON",
        });
    } catch {
        atLimitThrew = true;
    }
    assert(!atLimitThrew, "Exactly at MAX_TOKENS does not throw (limit is exclusive)");
}

// ── TEST 8: Invocation limit exceeded → CostLimitExceeded thrown ─────

async function test_invocation_limit_exceeded() {
    console.log("\nTest 8: Invocation limit exceeded → CostLimitExceeded thrown");

    let caught = false;
    let errorCode = "";

    try {
        enforceCostLimits(0, COST_LIMITS.MAX_INVOCATIONS + 1, {
            execution_id: "gov-test-008",
            stage: "ACT",
        });
    } catch (err) {
        if (err instanceof CostLimitExceeded) {
            caught = true;
            errorCode = err.code;
        }
    }

    assert(caught, "CostLimitExceeded is thrown when invocations exceed MAX_INVOCATIONS");
    assert(errorCode === "INVOCATION_LIMIT_EXCEEDED", `Error code is INVOCATION_LIMIT_EXCEEDED (got: ${errorCode})`);

    // Exactly at limit should NOT throw
    let atLimitThrew = false;
    try {
        enforceCostLimits(0, COST_LIMITS.MAX_INVOCATIONS, {
            execution_id: "gov-test-008b",
            stage: "ACT",
        });
    } catch {
        atLimitThrew = true;
    }
    assert(!atLimitThrew, "Exactly at MAX_INVOCATIONS does not throw (limit is exclusive)");
}

// ── TEST 9: Within budget — no throw ─────────────────────────────────

async function test_within_budget_no_throw() {
    console.log("\nTest 9: Within budget → enforceCostLimits does not throw");

    let threw = false;
    try {
        enforceCostLimits(1000, 3, {
            execution_id: "gov-test-009",
            stage: "ACT",
        });
    } catch {
        threw = true;
    }
    assert(!threw, "1000 tokens + 3 invocations does not throw");
}

// ── RUN ALL TESTS ────────────────────────────────────────────────────

(async () => {
    try {
        await test_first_risky_plan_recorded();
        await test_repeated_plan_increments_count();
        await test_different_plans_have_different_hashes();
        await test_identical_plans_produce_same_hash();
        await test_recurrence_threshold_blocks_high_risk_plan();
        await test_explicit_block_prevents_execution();
        await test_token_budget_exceeded();
        await test_invocation_limit_exceeded();
        await test_within_budget_no_throw();
    } catch (err: any) {
        console.error("\n[TEST RUNNER] Unexpected error:", err.message ?? err);
        failed++;
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

    if (failed > 0) {
        process.exit(1);
    }
})();
