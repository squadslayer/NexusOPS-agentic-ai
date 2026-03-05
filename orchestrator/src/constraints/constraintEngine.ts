/**
 * constraintEngine.ts — Deterministic execution plan validator.
 *
 * This is the FINAL GATE before any state mutation occurs.
 * 100% non-LLM, pure logic, stateless, side-effect free.
 *
 * DESIGN PRINCIPLES:
 *   ✅ Deterministic only — no AI, no probabilistic scoring
 *   ✅ Pure function — stateless, fully unit-testable
 *   ✅ Fail-closed — if uncertain, block
 *   ❌ No external calls
 *   ❌ No async dependencies
 *
 * LAYERS OF DEFENSE:
 *   1. Global rules (step count)
 *   2. Tool whitelist enforcement
 *   3. File path safety (directory traversal, forbidden paths)
 *   4. Tool-specific constraints (CI limits, delete protection, PR guards)
 *   5. Risk recalculation (overrides planner advisory)
 */

import { ALLOWED_TOOLS } from "../schemas/plannerSchema";

// ── INTERFACES ───────────────────────────────────────────────────

export interface ExecutionStep {
    step_id: number;
    tool: string;
    action: string;
    parameters: Record<string, any>;
    expected_output: string;
    risk_level: "low" | "medium" | "high";
}

export interface ExecutionPlan {
    objective: string;
    steps: ExecutionStep[];
    estimated_risk: "low" | "medium" | "high";
}

export interface ConstraintResult {
    allowed: boolean;
    finalRisk: "low" | "medium" | "high";
    requiresApproval: boolean;
    reason?: string;
    violations: string[];
}

// ── FORBIDDEN PATHS ──────────────────────────────────────────────

const FORBIDDEN_PATH_PATTERNS = [
    ".env",
    ".github/workflows",
    "node_modules",
    "package-lock.json",
    "yarn.lock",
    ".git/",
    "../",
];

const PROTECTED_FILES = [
    "package.json",
    "tsconfig.json",
    "handler.ts",
];

// ── PATH VALIDATOR ───────────────────────────────────────────────

export function validatePath(path: string): boolean {
    if (!path || typeof path !== "string") return false;

    const normalized = path.toLowerCase().replace(/\\/g, "/");

    if (normalized.includes("..")) return false;

    for (const pattern of FORBIDDEN_PATH_PATTERNS) {
        if (normalized.includes(pattern.toLowerCase())) return false;
    }

    return true;
}

function isProtectedFile(path: string): boolean {
    const normalized = path.toLowerCase().replace(/\\/g, "/");
    const basename = normalized.split("/").pop() ?? "";

    return PROTECTED_FILES.some((f) => f.toLowerCase() === basename);
}

// ── RISK RECALCULATION ───────────────────────────────────────────

export function recalculateRisk(plan: ExecutionPlan): "low" | "medium" | "high" {
    let risk: "low" | "medium" | "high" = "low";

    if (plan.steps.length > 5) return "high";

    const fileOps = plan.steps.filter((s) =>
        ["update_file", "create_file", "delete_file"].includes(s.tool)
    );

    if (fileOps.length > 2) risk = "medium";

    if (plan.steps.some((s) => s.tool === "delete_file")) risk = "high";

    if (plan.steps.some((s) => s.tool === "run_ci") && risk === "low") risk = "medium";

    return risk;
}

// ── CONSTRAINT ENGINE ────────────────────────────────────────────

/**
 * Validates an execution plan against all constraint rules.
 * Returns a ConstraintResult indicating whether execution is allowed.
 *
 * This is the SINGLE AUTHORITY for execution safety.
 * The planner is advisory. This engine is authoritative.
 */
export function validateExecutionPlan(plan: ExecutionPlan): ConstraintResult {
    const violations: string[] = [];

    // ── Rule 1: Empty steps ──
    if (!plan.steps || plan.steps.length === 0) {
        return {
            allowed: false,
            finalRisk: "high",
            requiresApproval: false,
            reason: "No execution steps",
            violations: ["EMPTY_PLAN"],
        };
    }

    // ── Rule 2: Max steps ──
    if (plan.steps.length > 10) {
        return {
            allowed: false,
            finalRisk: "high",
            requiresApproval: false,
            reason: "Too many steps (max 10)",
            violations: ["MAX_STEPS_EXCEEDED"],
        };
    }

    // ── Rule 3: Tool whitelist ──
    for (const step of plan.steps) {
        if (!(ALLOWED_TOOLS as readonly string[]).includes(step.tool)) {
            violations.push(`INVALID_TOOL: ${step.tool} (step ${step.step_id})`);
        }
    }

    if (violations.length > 0) {
        return {
            allowed: false,
            finalRisk: "high",
            requiresApproval: false,
            reason: `Invalid tool detected`,
            violations,
        };
    }

    // ── Rule 4: File path safety ──
    for (const step of plan.steps) {
        const filePath =
            step.parameters?.file_path ??
            step.parameters?.file ??
            step.parameters?.path;

        if (filePath && !validatePath(filePath)) {
            violations.push(`FORBIDDEN_PATH: "${filePath}" (step ${step.step_id})`);
        }
    }

    if (violations.length > 0) {
        return {
            allowed: false,
            finalRisk: "high",
            requiresApproval: false,
            reason: "Forbidden file path detected",
            violations,
        };
    }

    // ── Rule 5: Tool-specific constraints ──

    // 5a. delete_file — cannot delete protected files
    for (const step of plan.steps) {
        if (step.tool === "delete_file") {
            const filePath =
                step.parameters?.file_path ??
                step.parameters?.file ??
                step.parameters?.path;

            if (filePath && isProtectedFile(filePath)) {
                violations.push(`DELETE_PROTECTED: "${filePath}" (step ${step.step_id})`);
            }
        }
    }

    // 5b. run_ci — allowed only once per plan
    const ciRuns = plan.steps.filter((s) => s.tool === "run_ci").length;
    if (ciRuns > 1) {
        violations.push(`MULTIPLE_CI_RUNS: ${ciRuns} CI runs (max 1)`);
    }

    // 5c. create_pr — only if risk is not high AND at least one file mutation exists
    const hasPR = plan.steps.some((s) => s.tool === "create_pr");
    const hasFileMutation = plan.steps.some((s) =>
        ["update_file", "create_file", "delete_file"].includes(s.tool)
    );

    if (hasPR && !hasFileMutation) {
        violations.push("PR_WITHOUT_MUTATION: create_pr requires prior file operation");
    }

    if (violations.length > 0) {
        return {
            allowed: false,
            finalRisk: "high",
            requiresApproval: false,
            reason: "Tool-specific constraint violation",
            violations,
        };
    }

    // ── Rule 6: Risk recalculation (overrides planner advisory) ──
    const finalRisk = recalculateRisk(plan);

    // PR not allowed if final risk is high
    if (hasPR && finalRisk === "high") {
        return {
            allowed: false,
            finalRisk: "high",
            requiresApproval: false,
            reason: "create_pr blocked: risk too high",
            violations: ["PR_HIGH_RISK"],
        };
    }

    return {
        allowed: true,
        finalRisk,
        requiresApproval: finalRisk === "high",
        violations: [],
    };
}
