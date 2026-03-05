/**
 * costMonitor.ts — LLM token and tool invocation cost enforcement (Phase-9).
 *
 * Provides deterministic enforcement of execution budgets.
 * Prevents runaway Bedrock costs and tool execution loops.
 *
 * DESIGN:
 *   ✅ Pure enforcement function — stateless, no I/O
 *   ✅ Throws CostLimitExceeded (typed, catchable) rather than returning a result
 *   ✅ Called at two lifecycle points: REASON (token check) and ACT (invocation check)
 *   ✅ estimateCost() provides observability logging without enforcing
 *   ❌ No retries — limit breaches are final
 *   ❌ No partial budgets — limits apply per execution invocation
 *
 * LIMITS (from Phase-9 spec):
 *   MAX_TOKENS      = 50,000  (combined input + output tokens)
 *   MAX_INVOCATIONS = 10      (tool calls per ACT stage execution)
 */

// ── ERROR TYPE ───────────────────────────────────────────────────────

export class CostLimitExceeded extends Error {
    public readonly code: string;
    public readonly context: CostContext;

    constructor(message: string, code: string, context: CostContext) {
        super(message);
        this.name = "CostLimitExceeded";
        this.code = code;
        this.context = context;
    }
}

// ── INTERFACES ───────────────────────────────────────────────────────

export interface CostContext {
    /** Execution ID for log traceability. */
    execution_id: string;
    /** Stage where the limit was breached (e.g. "REASON", "ACT"). */
    stage: string;
}

export interface CostReport {
    total_tokens: number;
    invocation_count: number;
    /** Estimated USD cost (rough approximation for observability only). */
    estimated_cost_usd: number;
    within_token_budget: boolean;
    within_invocation_budget: boolean;
}

// ── LIMITS ───────────────────────────────────────────────────────────

export const COST_LIMITS = {
    /** Maximum combined input + output tokens per execution. */
    MAX_TOKENS: 50_000,
    /** Maximum tool invocations per ACT stage run. */
    MAX_INVOCATIONS: 10,
    /**
     * Approximate cost per 1k tokens in USD (Claude 3 Haiku pricing).
     * Used for observability only — not for enforcement decisions.
     */
    COST_PER_1K_TOKENS_USD: 0.00025,
} as const;

// ── ENFORCEMENT ──────────────────────────────────────────────────────

/**
 * Enforces token and invocation budgets.
 *
 * Throws CostLimitExceeded if either limit is breached.
 * Callers must catch this error and return Stage.FAILED.
 *
 * @param totalTokens   Combined input + output tokens consumed so far.
 * @param invocationCount  Number of tool calls executed so far in ACT.
 * @param context       Traceability metadata for log/error messages.
 */
export function enforceCostLimits(
    totalTokens: number,
    invocationCount: number,
    context: CostContext
): void {
    if (totalTokens > COST_LIMITS.MAX_TOKENS) {
        console.error(JSON.stringify({
            event: "COST_LIMIT_EXCEEDED",
            reason: "TOKEN_BUDGET",
            execution_id: context.execution_id,
            stage: context.stage,
            total_tokens: totalTokens,
            limit: COST_LIMITS.MAX_TOKENS,
        }));

        throw new CostLimitExceeded(
            `Token budget exceeded: ${totalTokens} tokens used (limit: ${COST_LIMITS.MAX_TOKENS})`,
            "TOKEN_BUDGET_EXCEEDED",
            context
        );
    }

    if (invocationCount > COST_LIMITS.MAX_INVOCATIONS) {
        console.error(JSON.stringify({
            event: "COST_LIMIT_EXCEEDED",
            reason: "INVOCATION_LIMIT",
            execution_id: context.execution_id,
            stage: context.stage,
            invocation_count: invocationCount,
            limit: COST_LIMITS.MAX_INVOCATIONS,
        }));

        throw new CostLimitExceeded(
            `Invocation limit exceeded: ${invocationCount} tool calls (limit: ${COST_LIMITS.MAX_INVOCATIONS})`,
            "INVOCATION_LIMIT_EXCEEDED",
            context
        );
    }
}

// ── OBSERVABILITY ────────────────────────────────────────────────────

/**
 * Computes a cost report for observability logging.
 * Does NOT enforce — call enforceCostLimits() for enforcement.
 */
export function getCostReport(
    totalTokens: number,
    invocationCount: number
): CostReport {
    const estimated_cost_usd =
        (totalTokens / 1000) * COST_LIMITS.COST_PER_1K_TOKENS_USD;

    return {
        total_tokens: totalTokens,
        invocation_count: invocationCount,
        estimated_cost_usd: Math.round(estimated_cost_usd * 1_000_000) / 1_000_000,
        within_token_budget: totalTokens <= COST_LIMITS.MAX_TOKENS,
        within_invocation_budget: invocationCount <= COST_LIMITS.MAX_INVOCATIONS,
    };
}
