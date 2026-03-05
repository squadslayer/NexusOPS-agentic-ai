"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "@/lib/executionApi";
import type {
    ExecutionState,
    ExecutionLog,
    RiskDetail,
    ExecutionStatus
} from "@/lib/executionApi";

// ─── Actions hooks ─────────────────────────────────────────────────────────────

/** Create a new execution context */
export function useCreateExecution() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (payload: any) => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.createExecution(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { execute, isLoading, error };
}

/** Approve or reject an execution plan */
export function useValidateExecution() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (executionId: string, action: "APPROVE" | "REJECT") => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.validateExecution(executionId, action);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { execute, isLoading, error };
}

/** Explicitly trigger an execution run */
export function useRunExecution() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (executionId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.runExecution(executionId);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { execute, isLoading, error };
}

// ─── Query / Polling hooks ───────────────────────────────────────────────────

/**
 * Polls the execution state at a regular interval.
 * Stops polling when terminal states (COMPLETED, FAILED) are reached.
 */
export function useExecutionState(executionId: string | null, pollInterval = 2000) {
    const [state, setState] = useState<ExecutionState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isTerminalState = (status?: ExecutionStatus) =>
        status === "COMPLETED" || status === "FAILED";

    const fetchState = useCallback(async () => {
        if (!executionId) return;

        // Skip setting loading to true on every poll to avoid UI thrashing
        if (!state) setIsLoading(true);

        try {
            const data = await api.getExecutionState(executionId);
            setState(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [executionId, state]);

    useEffect(() => {
        if (!executionId) {
            setState(null);
            return;
        }

        // Initial fetch
        fetchState();

        // Setup polling
        if (!state || !isTerminalState(state.status)) {
            const timer = setInterval(fetchState, pollInterval);
            return () => clearInterval(timer);
        }
    }, [executionId, fetchState, pollInterval, state?.status]);

    return { state, isLoading, error, refresh: fetchState };
}

/**
 * Polls for new execution logs.
 */
export function useExecutionLogs(executionId: string | null, isActive = true, pollInterval = 2000) {
    const [logs, setLogs] = useState<ExecutionLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastTimestampRef = useRef<string | undefined>(undefined);

    const fetchLogs = useCallback(async () => {
        if (!executionId) return;

        if (logs.length === 0) setIsLoading(true);

        try {
            const newLogs = await api.getExecutionLogs(executionId, lastTimestampRef.current);
            if (newLogs.length > 0) {
                // Determine the highest timestamp to use for next query
                const latestTs = newLogs[newLogs.length - 1].timestamp;
                lastTimestampRef.current = latestTs;

                setLogs(prev => {
                    // Prevent duplicates in case of boundary overlap
                    const existingIds = new Set(prev.map(l => l.id));
                    const uniqueNewLogs = newLogs.filter(l => !existingIds.has(l.id));
                    return [...prev, ...uniqueNewLogs];
                });
            }
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [executionId, logs.length]);

    useEffect(() => {
        if (!executionId) {
            setLogs([]);
            lastTimestampRef.current = undefined;
            return;
        }

        fetchLogs();

        if (isActive) {
            const timer = setInterval(fetchLogs, pollInterval);
            return () => clearInterval(timer);
        }
    }, [executionId, isActive, fetchLogs, pollInterval]);

    return { logs, isLoading, error, refresh: fetchLogs };
}

/**
 * Fetch risk details for a given execution context.
 * Only loaded once, not polled.
 */
export function useRiskDetails(executionId: string | null) {
    const [risks, setRisks] = useState<RiskDetail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRisks = useCallback(async () => {
        if (!executionId) return;

        setIsLoading(true);
        setError(null);
        try {
            const data = await api.getRiskDetails(executionId);
            setRisks(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [executionId]);

    useEffect(() => {
        if (executionId) {
            fetchRisks();
        } else {
            setRisks([]);
        }
    }, [executionId, fetchRisks]);

    return { risks, isLoading, error, refresh: fetchRisks };
}
