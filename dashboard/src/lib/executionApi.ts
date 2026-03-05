/**
 * executionApi.ts
 * Abstractions for the Execution Lifecycle endpoints.
 * All API calls are fetch-based. Strictly typed. No direct AWS calls.
 */

import { apiFetch } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionStatus =
    | "INITIALIZING"
    | "PLANNING"
    | "AWAITING_VALIDATION"
    | "EXECUTING"
    | "COMPLETED"
    | "FAILED";

export interface ExecutionState {
    id: string;
    status: ExecutionStatus;
    contextId: string;
    createdAt: string;
    updatedAt: string;
    errorMessage?: string;
}

export interface ExecutionLog {
    id: string;
    timestamp: string;
    level: "INFO" | "WARN" | "ERROR";
    message: string;
}

export interface RiskDetail {
    id: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    resource: string;
    description: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await apiFetch(path, options);

    if (!res.ok) {
        let msg = "An API error occurred";
        try {
            const data = await res.json();
            if (data?.message) msg = data.message;
        } catch {
            // Ignore parse errors for non-JSON error responses
        }
        throw new Error(msg);
    }

    // Support no-content responses
    if (res.status === 204) {
        return {} as T;
    }

    return res.json() as Promise<T>;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export async function createExecution(contextPayload: any): Promise<ExecutionState> {
    return fetchApi<ExecutionState>("/executions", {
        method: "POST",
        body: JSON.stringify(contextPayload),
    });
}

export async function validateExecution(executionId: string, action: "APPROVE" | "REJECT"): Promise<ExecutionState> {
    return fetchApi<ExecutionState>(`/executions/${executionId}/validate`, {
        method: "POST",
        body: JSON.stringify({ action }),
    });
}

export async function runExecution(executionId: string): Promise<ExecutionState> {
    return fetchApi<ExecutionState>(`/executions/${executionId}/run`, {
        method: "POST",
    });
}

export async function getExecutionState(executionId: string): Promise<ExecutionState> {
    return fetchApi<ExecutionState>(`/executions/${executionId}`);
}

export async function getExecutionLogs(executionId: string, since?: string): Promise<ExecutionLog[]> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return fetchApi<ExecutionLog[]>(`/executions/${executionId}/logs${qs}`);
}

export async function getRiskDetails(executionId: string): Promise<RiskDetail[]> {
    return fetchApi<RiskDetail[]>(`/executions/${executionId}/risks`);
}
