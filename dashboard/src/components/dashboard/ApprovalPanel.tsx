"use client";

import { useEffect, useState, useMemo } from "react";
import {
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ShieldExclamationIcon,
    PlayIcon
} from "@heroicons/react/24/outline";
import { useExecutionState, useValidateExecution } from "@/hooks/useExecution";
import { StatusBadge, Panel, PanelHeader, PanelContent } from "@/components/dashboard/ControlPanelComponents";

interface ApprovalPanelProps {
    executionId: string;
    onExecute: () => void;
    // We pass in the created timestamp to base the countdown strictly on server time
    createdAtIso: string;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export function ApprovalPanel({ executionId, onExecute, createdAtIso }: ApprovalPanelProps) {
    const { state, isLoading: isPolling } = useExecutionState(executionId);
    const { execute: validate, isLoading: isValidating, error: validationError } = useValidateExecution();

    const [timeLeftMs, setTimeLeftMs] = useState<number>(FIFTEEN_MINUTES_MS);
    const [isExpired, setIsExpired] = useState(false);

    // --- Countdown Logic ---
    useEffect(() => {
        // If the state is no longer awaiting validation (approved, rejected, executing, completed)
        // we lock the countdown where it was or stop counting.
        if (state?.status !== "AWAITING_VALIDATION") return;

        const createdAt = new Date(createdAtIso).getTime();
        const expiresAt = createdAt + FIFTEEN_MINUTES_MS;

        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = expiresAt - now;

            if (remaining <= 0) {
                setTimeLeftMs(0);
                setIsExpired(true);
                clearInterval(interval);
            } else {
                setTimeLeftMs(remaining);
                setIsExpired(false);
            }
        }, 1000);

        // Run once immediately to avoid 1s lag rendering
        const now = Date.now();
        const initialRemaining = expiresAt - now;
        if (initialRemaining <= 0) {
            setTimeLeftMs(0);
            setIsExpired(true);
        } else {
            setTimeLeftMs(initialRemaining);
        }

        return () => clearInterval(interval);
    }, [createdAtIso, state?.status]);

    const formattedTime = useMemo(() => {
        if (timeLeftMs <= 0) return "00:00";
        const minutes = Math.floor(timeLeftMs / 60000);
        const seconds = Math.floor((timeLeftMs % 60000) / 1000);
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }, [timeLeftMs]);

    // --- Handlers ---
    const handleApprove = async () => {
        if (isExpired || isValidating) return;
        await validate(executionId, "APPROVE");
    };

    const handleReject = async () => {
        if (isExpired || isValidating) return;
        await validate(executionId, "REJECT");
    };

    // --- Render Helpers ---

    const isAwaiting = state?.status === "AWAITING_VALIDATION";
    const isApproved = state?.status === "EXECUTING" || state?.status === "COMPLETED"; // Oversimplified for UI; EXECUTING implies approved
    const isRejected = state?.status === "FAILED" && state?.errorMessage === "Execution rejected";

    // Default to strict panel styling
    let panelBorderClass = "border-border";
    let headerBgClass = "bg-surface";
    let statusBadge = <StatusBadge status="neutral" label="Unknown Context" />;

    if (isAwaiting) {
        if (isExpired) {
            panelBorderClass = "border-danger/30";
            headerBgClass = "bg-danger/5";
            statusBadge = <StatusBadge status="danger" label="Expired" />;
        } else {
            panelBorderClass = "border-warning/30";
            headerBgClass = "bg-warning/5";
            statusBadge = <StatusBadge status="warning" label="Approval Required" />;
        }
    } else if (isApproved) {
        panelBorderClass = "border-success/30";
        headerBgClass = "bg-success/5";
        statusBadge = <StatusBadge status="success" label="Approved" />;
    } else if (isRejected) {
        panelBorderClass = "border-danger/30";
        headerBgClass = "bg-danger/5";
        statusBadge = <StatusBadge status="danger" label="Rejected" />;
    } else if (state?.status === "PLANNING" || state?.status === "INITIALIZING") {
        panelBorderClass = "border-border";
        headerBgClass = "bg-surface";
        statusBadge = <StatusBadge status="pending" label="Planning" />;
    }

    // --- Render ---
    return (
        <Panel className={`flex flex-col min-h-0 transition-colors ${panelBorderClass}`}>
            <PanelHeader
                title="Validation Gate"
                className={`${headerBgClass} transition-colors`}
                status={statusBadge}
                action={
                    isAwaiting && !isExpired && (
                        <div className={`flex items-center gap-1.5 font-mono text-sm px-2 py-1 rounded bg-background border ${timeLeftMs < 120000 ? "text-dangerText border-danger/20" : "text-textSub border-border"}`}>
                            <ClockIcon className="h-4 w-4" />
                            <span>{formattedTime}</span>
                        </div>
                    )
                }
            />
            <PanelContent className={`flex flex-col flex-1 items-center justify-center text-center p-6 ${headerBgClass} transition-colors`}>

                {/* Banner / State Feedback */}
                {!state ? (
                    <div className="animate-pulse flex flex-col items-center">
                        <ShieldExclamationIcon className="h-10 w-10 text-textMuted/40 mb-3" />
                        <p className="text-sm text-textMuted">Loading context...</p>
                    </div>
                ) : isAwaiting && !isExpired ? (
                    <>
                        <ExclamationTriangleIcon className="h-10 w-10 text-warningText mb-3" />
                        <h4 className="text-sm font-semibold text-textMain mb-1">Manual Approval Required</h4>
                        <p className="text-xs text-textSub max-w-sm mb-6 leading-relaxed">
                            Review the execution plan carefully. The system will hold this context for 15 minutes before expiring.
                        </p>

                        <div className="flex gap-3 w-full max-w-[240px]">
                            <button
                                onClick={handleApprove}
                                disabled={isValidating || isPolling}
                                className="btn btn-primary flex-1 py-2 text-sm"
                            >
                                {isValidating ? "Saving..." : "Approve"}
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isValidating || isPolling}
                                className="btn bg-background border border-border flex-1 py-2 text-sm text-dangerText hover:bg-danger/10 hover:border-danger/30 focus:ring-danger"
                            >
                                Reject
                            </button>
                        </div>
                    </>
                ) : isAwaiting && isExpired ? (
                    <>
                        <ClockIcon className="h-10 w-10 text-dangerText opacity-80 mb-3" />
                        <h4 className="text-sm font-semibold text-dangerText mb-1">Session Expired</h4>
                        <p className="text-xs text-textSub max-w-sm mb-4">
                            The 15-minute approval window has elapsed. You must generate a new execution plan to continue.
                        </p>
                    </>
                ) : isApproved ? (
                    <>
                        <CheckCircleIcon className="h-10 w-10 text-successText mb-3" />
                        <h4 className="text-sm font-semibold text-textMain mb-1">Execution Approved</h4>
                        <p className="text-xs text-textSub max-w-sm mb-6">
                            Validation gate cleared. The operation is ready to proceed.
                        </p>
                        <button
                            onClick={onExecute}
                            className="btn btn-success flex items-center gap-2 group"
                        >
                            <PlayIcon className="h-4 w-4" />
                            Run Execution
                        </button>
                    </>
                ) : isRejected ? (
                    <>
                        <XCircleIcon className="h-10 w-10 text-dangerText mb-3" />
                        <h4 className="text-sm font-semibold text-dangerText mb-1">Execution Rejected</h4>
                        <p className="text-xs text-textSub max-w-sm">
                            The validation gate was denied. No changes were applied.
                        </p>
                    </>
                ) : (
                    <>
                        <ShieldExclamationIcon className="h-10 w-10 text-textMuted/40 mb-3" />
                        <h4 className="text-sm font-semibold text-textMain mb-1">Awaiting Context</h4>
                        <p className="text-xs text-textSub max-w-sm">
                            Initialize a new execution to begin validation.
                        </p>
                    </>
                )}

                {/* Optional validation error banner */}
                {validationError && (
                    <div className="mt-4 w-full flex items-center gap-2 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-dangerText">
                        <XCircleIcon className="h-4 w-4 shrink-0" />
                        <span>{validationError}</span>
                    </div>
                )}
            </PanelContent>
        </Panel>
    );
}

export default ApprovalPanel;
