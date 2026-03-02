/**
 * response.ts — Standardized API response format.
 *
 * Every orchestrator output flows through this builder
 * to keep API responses deterministic and consistent.
 */

export interface OrchestratorResponse<T = unknown> {
    success: boolean;
    data: T | null;
    error: string | null;
    meta: Record<string, unknown>;
}

export function successResponse<T>(data: T, meta: Record<string, unknown> = {}): OrchestratorResponse<T> {
    return {
        success: true,
        data,
        error: null,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta,
        },
    };
}

export function errorResponse(error: string, meta: Record<string, unknown> = {}): OrchestratorResponse<null> {
    return {
        success: false,
        data: null,
        error,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta,
        },
    };
}
