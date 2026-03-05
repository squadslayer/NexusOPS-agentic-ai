"use client";

import { useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import {
    CpuChipIcon,
    ExclamationTriangleIcon,
    NoSymbolIcon,
    CurrencyDollarIcon
} from "@heroicons/react/24/outline";

export interface CostData {
    invocations: number;
    inputTokens: number;
    outputTokens: number;
    /** Estimated cost in USD */
    estimatedCostUsd: number;
    /** Whether execution was halted due to exceeding the limit */
    isAborted: boolean;
    /** Configured maximum threshold in USD */
    thresholdUsd: number;
}

interface CostIndicatorProps {
    data: CostData | null;
    className?: string;
}

export function CostIndicator({ data, className = "" }: CostIndicatorProps) {
    const isWarning = useMemo(() => {
        if (!data || data.isAborted) return false;
        // Warn if reached 80% of threshold
        return data.estimatedCostUsd >= data.thresholdUsd * 0.8;
    }, [data]);

    if (!data) {
        return (
            <div className={`card p-4 flex items-center justify-between opacity-50 ${className}`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-surface border border-border">
                        <CpuChipIcon className="h-5 w-5 text-textMuted" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-textMain">Bedrock Usage</p>
                        <p className="text-xs text-textMuted font-mono">Awaiting execution context...</p>
                    </div>
                </div>
            </div>
        );
    }

    const {
        invocations,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        thresholdUsd,
        isAborted
    } = data;

    const totalTokens = inputTokens + outputTokens;

    return (
        <div className={`card p-0 overflow-hidden flex flex-col ${isAborted ? 'border-danger/40 ring-1 ring-danger/20' : isWarning ? 'border-warning/40 ring-1 ring-warning/20' : ''} ${className}`}>

            {/* Header Area */}
            <div className={`
                p-4 flex items-center justify-between border-b 
                ${isAborted ? 'bg-danger/5 border-danger/20' : isWarning ? 'bg-warning/5 border-warning/20' : 'bg-surface border-border'}
            `}>
                <div className="flex items-center gap-3">
                    <div className={`
                        p-2 rounded border
                        ${isAborted ? 'bg-danger/10 border-danger/20' : isWarning ? 'bg-warning/10 border-warning/20' : 'bg-background border-border'}
                    `}>
                        {isAborted ? (
                            <NoSymbolIcon className="h-5 w-5 text-dangerText" />
                        ) : (
                            <CpuChipIcon className={`h-5 w-5 ${isWarning ? 'text-warningText' : 'text-primary'}`} />
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-textMain flex items-center gap-2">
                            LLM Operations
                            {isAborted && (
                                <span className="badge badge-danger text-2xs">ABORTED (LIMIT EXCEEDED)</span>
                            )}
                            {isWarning && !isAborted && (
                                <span className="badge badge-warning text-2xs animate-pulse">THRESHOLD WARNING</span>
                            )}
                        </h3>
                        <p className="text-xs text-textSub mt-0.5">
                            Threshold: ${thresholdUsd.toFixed(2)}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <p className={`text-xl font-bold tracking-tight flex items-center justify-end ${isAborted ? 'text-dangerText' : isWarning ? 'text-warningText' : 'text-textMain'}`}>
                        <CurrencyDollarIcon className="h-5 w-5 mr-0.5 opacity-80" />
                        {estimatedCostUsd.toFixed(4)}
                    </p>
                    <p className="text-2xs text-textMuted uppercase font-semibold tracking-wider">
                        Current Cost
                    </p>
                </div>
            </div>

            {/* Metrics Area */}
            <div className={`p-4 grid grid-cols-3 gap-4 ${isAborted ? 'bg-danger/5' : isWarning ? 'bg-warning/5' : 'bg-background'}`}>

                {/* Invocations */}
                <div className="flex flex-col">
                    <span className="text-2xs text-textMuted uppercase font-semibold tracking-wider mb-1">
                        Invocations
                    </span>
                    <span className="text-sm font-mono text-textMain">
                        {formatNumber(invocations)}
                    </span>
                </div>

                {/* Total Tokens */}
                <div className="flex flex-col">
                    <span className="text-2xs text-textMuted uppercase font-semibold tracking-wider mb-1">
                        Total Tokens
                    </span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-mono text-textMain">
                            {formatNumber(totalTokens)}
                        </span>
                        {/* Token split tooltip/indicator */}
                        <div
                            className="flex -space-x-1"
                            title={`In: ${formatNumber(inputTokens)} | Out: ${formatNumber(outputTokens)}`}
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 outline outline-1 outline-background z-10" />
                            <div className="w-1.5 h-1.5 rounded-full bg-success/40 outline outline-1 outline-background" />
                        </div>
                    </div>
                </div>

                {/* Progress / Status */}
                <div className="flex flex-col justify-end min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs text-textMuted uppercase font-semibold tracking-wider">
                            Capacity
                        </span>
                        <span className="text-2xs font-mono text-textSub">
                            {Math.round((estimatedCostUsd / thresholdUsd) * 100)}%
                        </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border/50">
                        <div
                            className={`h-full transition-all duration-300 ${isAborted ? 'bg-dangerText' : isWarning ? 'bg-warningText' : 'bg-primary'}`}
                            style={{ width: `${Math.min((estimatedCostUsd / thresholdUsd) * 100, 100)}%` }}
                        />
                    </div>
                </div>

            </div>

            {/* Warning Banner Context */}
            {isAborted && (
                <div className="px-4 py-3 bg-danger/10 border-top border-danger/20 flex items-start gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-dangerText mt-0.5 shrink-0" />
                    <p className="text-xs text-dangerText">
                        The operation was forcibly halted because it exceeded the configured maximum cost threshold of ${thresholdUsd.toFixed(2)}. No further changes will be executed.
                    </p>
                </div>
            )}
        </div>
    );
}

export default CostIndicator;
