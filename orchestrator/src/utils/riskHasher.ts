/**
 * riskHasher.ts — Deterministic execution plan fingerprinting (Phase-9).
 *
 * Produces a stable SHA-256 hash over the canonical JSON serialization
 * of an ExecutionPlan. Identical plans always produce identical hashes.
 *
 * DESIGN:
 *   ✅ Pure function — no state, no I/O, no async
 *   ✅ Deterministic — same plan → same hash regardless of call order
 *   ✅ Canonical serialization — keys sorted to prevent ordering variance
 *   ❌ Must NOT include execution_id or timestamps in the hash input
 *      (those change per invocation; only plan content is fingerprinted)
 */

import crypto from "crypto";
import { ExecutionPlan } from "../constraints/constraintEngine";

/**
 * Recursively sorts object keys to produce a stable JSON representation.
 * Prevents key-insertion-order variance from producing different hashes.
 */
function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }

    if (value !== null && typeof value === "object") {
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(value as object).sort()) {
            sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
        }
        return sorted;
    }

    return value;
}

/**
 * Computes a deterministic SHA-256 fingerprint of an ExecutionPlan.
 *
 * The hash is derived from the plan's objective and steps only —
 * metadata fields that vary between invocations are excluded.
 *
 * @returns 64-character lowercase hex string
 */
export function computeRiskHash(plan: ExecutionPlan): string {
    // Only hash the structurally significant fields of the plan
    const hashInput = {
        objective: plan.objective,
        steps: plan.steps,
        estimated_risk: plan.estimated_risk,
    };

    const canonical = JSON.stringify(canonicalize(hashInput));

    return crypto
        .createHash("sha256")
        .update(canonical, "utf8")
        .digest("hex");
}
