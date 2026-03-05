"use client";

import { useSearchParams } from "next/navigation";
import { useExecutionStream } from "@/hooks/useExecutionStream";
import {
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    CpuChipIcon,
    ShieldCheckIcon,
    DocumentMagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import { clsx } from "clsx";

const STAGES = [
    { id: "ASK", label: "Ask", icon: MagnifyingGlassIcon },
    { id: "RETRIEVE", label: "Retrieve", icon: DocumentMagnifyingGlassIcon },
    { id: "REASON", label: "Reason", icon: CpuChipIcon },
    { id: "ACT", label: "Act", icon: ArrowPathIcon },
    { id: "VERIFY", label: "Verify", icon: ShieldCheckIcon },
];

export function ExecutionOverlay() {
    const searchParams = useSearchParams();
    const executionId = searchParams.get("executionId");

    const { lastEvent, isConnected } = useExecutionStream(executionId);

    if (!executionId) return null;

    const currentStage = lastEvent?.stage || "ASK";
    const status = lastEvent?.status || "running";

    const getStageIndex = (stageId: string) => STAGES.findIndex(s => s.id === stageId);
    const currentIndex = getStageIndex(currentStage);

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-primary/5 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-textMain">Live Analysis</h3>
                        <p className="text-2xs text-textMuted font-mono uppercase tracking-wider">{executionId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={clsx(
                            "h-2 w-2 rounded-full",
                            isConnected ? "bg-success animate-pulse" : "bg-danger"
                        )} />
                        <span className="text-2xs text-textMuted font-medium uppercase">
                            {isConnected ? "Connected" : "Offline"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <div className="relative">
                    {/* Progress Track */}
                    <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border z-0" />

                    <div className="flex flex-col gap-8 relative z-10">
                        {STAGES.map((stage, index) => {
                            const isPast = index < currentIndex || (index === currentIndex && status === "completed");
                            const isCurrent = index === currentIndex && status === "running";
                            const isFuture = index > currentIndex;
                            const isFailed = index === currentIndex && status === "failed";

                            const Icon = stage.icon;

                            return (
                                <div key={stage.id} className="flex items-center gap-4">
                                    <div className={clsx(
                                        "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                                        isPast && "bg-success/10 border-success text-success",
                                        isCurrent && "bg-primary/10 border-primary text-primary animate-pulse scale-110 shadow-lg shadow-primary/20",
                                        isFuture && "bg-card border-border text-textMuted",
                                        isFailed && "bg-danger/10 border-danger text-danger"
                                    )}>
                                        {isPast ? (
                                            <CheckCircleIcon className="h-5 w-5" />
                                        ) : isFailed ? (
                                            <XCircleIcon className="h-5 w-5" />
                                        ) : (
                                            <Icon className={clsx("h-5 w-5", isCurrent && "animate-spin-slow")} />
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={clsx(
                                            "text-sm font-medium transition-colors duration-300",
                                            isPast && "text-textMain",
                                            isCurrent && "text-primary font-bold",
                                            isFuture && "text-textMuted",
                                            isFailed && "text-danger"
                                        )}>
                                            {stage.label}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-2xs text-textMuted animate-pulse">Processing...</span>
                                        )}
                                        {isFailed && (
                                            <span className="text-2xs text-danger font-medium">Stage Failed</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {status === "completed" && (
                <div className="p-4 bg-success/5 border-t border-border flex justify-center">
                    <button
                        className="text-xs font-semibold text-success hover:underline"
                        onClick={() => {/* Navigate to full report */ }}
                    >
                        View Full Analysis Report
                    </button>
                </div>
            )}
        </div>
    );
}
