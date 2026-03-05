/**
 * constraintEngine.test.ts — Unit tests for Phase-6 Constraint Engine.
 *
 * All tests run locally without AWS.
 * Tests cover: tool whitelist, path safety, delete protection,
 * step limits, CI limits, PR guards, risk recalculation.
 */

import {
    validateExecutionPlan,
    validatePath,
    recalculateRisk,
    ExecutionPlan,
    ExecutionStep,
} from "./constraintEngine";

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
    return {
        step_id: 1,
        tool: "update_file",
        action: "Update config",
        parameters: { file: "src/config.ts" },
        expected_output: "File updated",
        risk_level: "low",
        ...overrides,
    };
}

function makePlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
    return {
        objective: "Test plan",
        steps: [makeStep()],
        estimated_risk: "low",
        ...overrides,
    };
}

// ── GLOBAL RULES ─────────────────────────────────────────────────

console.log("=== Constraint Engine Unit Tests ===\n");

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

// Test 1: Valid plan passes
{
    const result = validateExecutionPlan(makePlan());
    assert(result.allowed === true, "Valid plan is allowed");
}

// Test 2: Empty steps rejected
{
    const result = validateExecutionPlan(makePlan({ steps: [] }));
    assert(result.allowed === false, "Empty steps rejected");
    assert(result.violations.includes("EMPTY_PLAN"), "Empty plan violation recorded");
}

// Test 3: Too many steps rejected
{
    const steps = Array.from({ length: 11 }, (_, i) => makeStep({ step_id: i + 1 }));
    const result = validateExecutionPlan(makePlan({ steps }));
    assert(result.allowed === false, "11 steps rejected");
    assert(result.violations.includes("MAX_STEPS_EXCEEDED"), "Max steps violation recorded");
}

// ── TOOL WHITELIST ───────────────────────────────────────────────

// Test 4: Invalid tool rejected
{
    const result = validateExecutionPlan(makePlan({
        steps: [makeStep({ tool: "exec_shell" })],
    }));
    assert(result.allowed === false, "Invalid tool 'exec_shell' rejected");
}

// Test 5: All valid tools accepted
{
    const validTools = ["update_file", "create_file", "delete_file", "run_ci", "create_pr"];
    for (const tool of validTools) {
        const result = validateExecutionPlan(makePlan({
            steps: [
                makeStep({ tool: tool as any }),
                ...(tool === "create_pr" ? [makeStep({ tool: "update_file" })] : []),
            ],
        }));
        assert(result.allowed === true || result.requiresApproval === true, `Tool '${tool}' accepted`);
    }
}

// ── PATH SAFETY ──────────────────────────────────────────────────

// Test 6: Directory traversal blocked
{
    assert(validatePath("../../etc/passwd") === false, "Directory traversal blocked");
}

// Test 7: .env blocked
{
    assert(validatePath(".env") === false, ".env path blocked");
    assert(validatePath("config/.env.production") === false, ".env.production blocked");
}

// Test 8: .github/workflows blocked
{
    assert(validatePath(".github/workflows/deploy.yml") === false, "Workflow file blocked");
}

// Test 9: node_modules blocked
{
    assert(validatePath("node_modules/express/index.js") === false, "node_modules blocked");
}

// Test 10: .git blocked
{
    assert(validatePath(".git/config") === false, ".git path blocked");
}

// Test 11: Valid paths pass
{
    assert(validatePath("src/handler.ts") === true, "Valid src path passes");
    assert(validatePath("lib/utils/helper.ts") === true, "Valid lib path passes");
}

// ── FILE PATH IN PLAN ────────────────────────────────────────────

// Test 12: Plan with forbidden path rejected
{
    const result = validateExecutionPlan(makePlan({
        steps: [makeStep({ parameters: { file_path: "../../../etc/passwd" } })],
    }));
    assert(result.allowed === false, "Plan with traversal path rejected");
}

// ── TOOL-SPECIFIC ────────────────────────────────────────────────

// Test 13: Delete protected file rejected
{
    const result = validateExecutionPlan(makePlan({
        steps: [makeStep({ tool: "delete_file", parameters: { file: "package.json" } })],
    }));
    assert(result.allowed === false, "Delete package.json rejected");
}

// Test 14: Multiple CI runs rejected
{
    const result = validateExecutionPlan(makePlan({
        steps: [
            makeStep({ step_id: 1, tool: "run_ci", parameters: { pipeline: "test" } }),
            makeStep({ step_id: 2, tool: "run_ci", parameters: { pipeline: "deploy" } }),
        ],
    }));
    assert(result.allowed === false, "Multiple CI runs rejected");
}

// Test 15: PR without file mutation rejected
{
    const result = validateExecutionPlan(makePlan({
        steps: [makeStep({ tool: "create_pr", parameters: { title: "empty PR" } })],
    }));
    assert(result.allowed === false, "PR without file mutation rejected");
}

// ── RISK RECALCULATION ───────────────────────────────────────────

// Test 16: Steps > 5 → high risk
{
    const steps = Array.from({ length: 6 }, (_, i) => makeStep({ step_id: i + 1 }));
    const risk = recalculateRisk(makePlan({ steps }));
    assert(risk === "high", "6 steps → high risk");
}

// Test 17: Delete present → high risk
{
    const risk = recalculateRisk(makePlan({
        steps: [makeStep({ tool: "delete_file" })],
    }));
    assert(risk === "high", "Delete file → high risk");
}

// Test 18: 3+ file ops → medium risk
{
    const risk = recalculateRisk(makePlan({
        steps: [
            makeStep({ step_id: 1 }),
            makeStep({ step_id: 2 }),
            makeStep({ step_id: 3, tool: "create_file" }),
        ],
    }));
    assert(risk === "medium", "3 file ops → medium risk");
}

// Test 19: Low risk plan stays low
{
    const risk = recalculateRisk(makePlan({
        steps: [makeStep()],
    }));
    assert(risk === "low", "Single update → low risk");
}

// ── SUMMARY ──────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
    process.exit(1);
}
