"use client";

import { useState, useEffect } from "react";

type ExecutionEvent = {
    execution_id: string;
    stage: "ASK" | "RETRIEVE" | "REASON" | "ACT" | "VERIFY" | "COMPLETE" | "FAILED";
    status: "running" | "completed" | "failed";
    timestamp: string;
};

export function useExecutionStream(executionId: string | null) {
    const [lastEvent, setLastEvent] = useState<ExecutionEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!executionId) {
            setLastEvent(null);
            setIsConnected(false);
            return;
        }

        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws/executions/${executionId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`Connected to execution stream: ${executionId}`);
            setIsConnected(true);
            setError(null);
        };

        ws.onmessage = (event) => {
            try {
                const data: ExecutionEvent = JSON.parse(event.data);
                setLastEvent(data);
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        ws.onerror = () => {
            setError("WebSocket connection error");
            setIsConnected(false);
        };

        ws.onclose = () => {
            console.log(`Disconnected from execution stream: ${executionId}`);
            setIsConnected(false);
        };

        return () => {
            ws.close();
        };
    }, [executionId]);

    return { lastEvent, isConnected, error };
}
