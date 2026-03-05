/**
 * toolExecutor.ts — Tool dispatch engine for the ACT stage.
 *
 * Dispatches each plan step to a named tool handler.
 * For Phase-8 local validation, all handlers are simulated
 * (deterministic outputs, realistic latency tracking).
 *
 * DESIGN PRINCIPLES:
 *   ✅ Dispatches only tools in ALLOWED_TOOLS whitelist
 *   ✅ Each handler is independently replaceable with a real implementation
 *   ✅ Returns structured ToolResult (never throws)
 *   ✅ Measures wall-clock latency for every call
 *   ❌ Does NOT re-validate the tool — constraint engine already did this
 *   ❌ No retries on failure
 *   ❌ No concurrent execution
 *
 * Production migration path:
 *   Replace each simulate_* handler body with a real GitHub API call
 *   via the existing `retrievalService.ts` GitHub client.
 */

import { ExecutionStep } from "../constraints/constraintEngine";

// ── TYPES ──────────────────────────────────────────────────────────

export interface ToolContext {
    /** Execution ID — passed to tool handlers for traceability. */
    execution_id: string;
    /** Repository ID — tool target (e.g. GitHub repo full name). */
    repo_id: string;
    /** User ID — audit trail for the tool call. */
    user_id: string;
}

export interface ToolResult {
    /** Whether the tool completed successfully. */
    success: boolean;
    /** Human-readable output from the tool. */
    output: string;
    /** Wall-clock execution time in milliseconds. */
    latency_ms: number;
    /** Error message if success is false. */
    error?: string;
}

// ── HANDLERS ────────────────────────────────────────────────────────

/**
 * Simulates creating a new file in the target repository.
 * Production: replace with GitHub Contents API `PUT /repos/:owner/:repo/contents/:path`
 */
async function handle_create_file(
    step: ExecutionStep,
    ctx: ToolContext
): Promise<Omit<ToolResult, "latency_ms">> {
    const filePath = step.parameters?.file_path ?? step.parameters?.file ?? step.parameters?.path ?? "unknown";

    console.log(`[TOOL: create_file] Execution: ${ctx.execution_id} | Path: ${filePath}`);

    // Simulate I/O delay
    await new Promise(res => setTimeout(res, 30));

    return {
        success: true,
        output: `File created: ${filePath}`,
    };
}

/**
 * Simulates updating an existing file in the target repository.
 * Production: replace with GitHub Contents API `PUT /repos/:owner/:repo/contents/:path`
 */
async function handle_update_file(
    step: ExecutionStep,
    ctx: ToolContext
): Promise<Omit<ToolResult, "latency_ms">> {
    const filePath = step.parameters?.file_path ?? step.parameters?.file ?? step.parameters?.path ?? "unknown";

    console.log(`[TOOL: update_file] Execution: ${ctx.execution_id} | Path: ${filePath}`);

    await new Promise(res => setTimeout(res, 40));

    return {
        success: true,
        output: `File updated: ${filePath}`,
    };
}

/**
 * Simulates deleting a file from the target repository.
 * Production: replace with GitHub Contents API `DELETE /repos/:owner/:repo/contents/:path`
 */
async function handle_delete_file(
    step: ExecutionStep,
    ctx: ToolContext
): Promise<Omit<ToolResult, "latency_ms">> {
    const filePath = step.parameters?.file_path ?? step.parameters?.file ?? step.parameters?.path ?? "unknown";

    console.log(`[TOOL: delete_file] Execution: ${ctx.execution_id} | Path: ${filePath}`);

    await new Promise(res => setTimeout(res, 35));

    return {
        success: true,
        output: `File deleted: ${filePath}`,
    };
}

/**
 * Simulates triggering a CI pipeline run.
 * Production: replace with GitHub Actions API `POST /repos/:owner/:repo/actions/workflows/:workflow_id/dispatches`
 */
async function handle_run_ci(
    step: ExecutionStep,
    ctx: ToolContext
): Promise<Omit<ToolResult, "latency_ms">> {
    const pipeline = step.parameters?.pipeline ?? "default";

    console.log(`[TOOL: run_ci] Execution: ${ctx.execution_id} | Pipeline: ${pipeline}`);

    // CI runs are slower — simulate realistic latency
    await new Promise(res => setTimeout(res, 80));

    return {
        success: true,
        output: `CI pipeline '${pipeline}' triggered — run_id: ci-${Date.now()}`,
    };
}

/**
 * Simulates creating a pull request in the target repository.
 * Production: replace with GitHub Pulls API `POST /repos/:owner/:repo/pulls`
 */
async function handle_create_pr(
    step: ExecutionStep,
    ctx: ToolContext
): Promise<Omit<ToolResult, "latency_ms">> {
    const title = step.parameters?.title ?? `NexusOPS: ${step.action}`;
    const branch = step.parameters?.branch ?? "nexusops/auto";

    console.log(`[TOOL: create_pr] Execution: ${ctx.execution_id} | Title: ${title}`);

    await new Promise(res => setTimeout(res, 50));

    return {
        success: true,
        output: `Pull request created: "${title}" (branch: ${branch})`,
    };
}

// ── DISPATCH TABLE ───────────────────────────────────────────────────

type ToolHandler = (step: ExecutionStep, ctx: ToolContext) => Promise<Omit<ToolResult, "latency_ms">>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
    create_file: handle_create_file,
    update_file: handle_update_file,
    delete_file: handle_delete_file,
    run_ci: handle_run_ci,
    create_pr: handle_create_pr,
};

// ── PUBLIC API ───────────────────────────────────────────────────────

/**
 * Executes a single plan step using the appropriate tool handler.
 *
 * Always returns a ToolResult — never throws.
 * Errors are captured and surfaced as success=false with an error field.
 */
export async function executeTool(
    step: ExecutionStep,
    context: ToolContext
): Promise<ToolResult> {
    const handler = TOOL_HANDLERS[step.tool];

    if (!handler) {
        // Should never reach here if constraint engine ran correctly,
        // but we guard defensively.
        return {
            success: false,
            output: "",
            latency_ms: 0,
            error: `Unknown tool: "${step.tool}" — not in dispatch table`,
        };
    }

    const start = Date.now();

    try {
        const result = await handler(step, context);
        const latency_ms = Date.now() - start;

        return {
            ...result,
            latency_ms,
        };
    } catch (err: any) {
        const latency_ms = Date.now() - start;

        console.error(`[TOOL EXECUTOR] Tool "${step.tool}" threw unexpectedly: ${err.message}`);

        return {
            success: false,
            output: "",
            latency_ms,
            error: err.message ?? "Tool threw an unexpected error",
        };
    }
}
