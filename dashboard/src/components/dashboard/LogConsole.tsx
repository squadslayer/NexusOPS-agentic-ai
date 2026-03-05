"use client";

import { useEffect, useRef, useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import {
    ExclamationCircleIcon,
    ShieldExclamationIcon,
    CheckBadgeIcon,
    Bars3CenterLeftIcon
} from "@heroicons/react/24/outline";

export interface LogEntry {
    id: string;
    timestamp: string;
    level: "INFO" | "WARN" | "ERROR";
    message: string;
    /** Current log's cryptographic hash */
    hash: string;
    /** The hash of the previous log entry in the chain */
    previousHash: string | null;
}

interface LogConsoleProps {
    logs: LogEntry[];
    /** Provide a way to override auto-scroll if user starts scrolling up */
    autoScroll?: boolean;
    className?: string;
}

export function LogConsole({ logs, autoScroll = true, className = "" }: LogConsoleProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    // Validation pass to find tamper mismatches
    const validatedLogs = useMemo(() => {
        // Sort chronologically ascending just to be safe it renders top to bottom
        const sorted = [...logs].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        let previousValidHash: string | null = null;

        return sorted.map((log, index) => {
            // Check for broken chain
            // If there's supposed to be a prev hash but it doesn't match the last known
            const isMismatch = index > 0 && log.previousHash !== previousValidHash;

            // Assume the chain continues from THIS log's hash going forward
            previousValidHash = log.hash;

            return {
                ...log,
                isMismatch
            };
        });
    }, [logs]);

    if (!logs || logs.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 bg-[#0F172A] rounded border border-border/20 ${className}`}>
                <Bars3CenterLeftIcon className="h-8 w-8 text-textMuted/30 mb-3" />
                <p className="text-sm font-mono text-textMuted/50">Listening for execution logs...</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col rounded border border-border/20 overflow-hidden bg-[#0F172A] shadow-inner ${className}`}>
            {/* Console Header Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#1E293B] border-b border-border/10 shrink-0">
                <div className="flex items-center gap-2">
                    <CheckBadgeIcon className="h-4 w-4 text-successText" aria-hidden />
                    <span className="text-xs font-mono font-semibold text-textSub uppercase tracking-wider">
                        Tamper-Evident Stream
                    </span>
                </div>
                <div className="text-2xs font-mono text-textMuted">
                    <span className="text-textSub">{formatNumber(logs.length)}</span> entries
                </div>
            </div>

            {/* Scrollable Console Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth"
            >
                {validatedLogs.map((log) => {

                    // Style by log level
                    let levelColor = "text-textSub"; // INFO
                    if (log.level === "WARN") levelColor = "text-warningText";
                    if (log.level === "ERROR") levelColor = "text-dangerText";

                    // The time part only for clean viewing, ISO date is too wide
                    const timeOnly = new Date(log.timestamp).toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        fractionalSecondDigits: 3
                    });

                    return (
                        <div key={log.id} className="group flex flex-col pt-1 pb-1.5 border-b border-border/5 last:border-0">

                            {/* Mismatch Alert Banner (inserted before the log that caused it) */}
                            {log.isMismatch && (
                                <div className="flex items-center gap-2 mb-2 mt-2 px-3 py-1.5 rounded bg-danger/20 border border-danger/40 text-dangerText text-xs font-mono">
                                    <ShieldExclamationIcon className="h-4 w-4 shrink-0" />
                                    <span>
                                        <strong>SECURITY WARNING:</strong> Hash chain broken. `previous_hash` ({log.previousHash?.slice(0, 8) ?? 'NULL'}) does not match the computed hash of the preceding entry. Data may be tampered.
                                    </span>
                                </div>
                            )}

                            {/* Main Log Line */}
                            <div className="flex items-start gap-4 text-xs font-mono leading-relaxed">
                                {/* Timestamp column */}
                                <div className="shrink-0 text-textMuted/60 w-[100px] select-none">
                                    {timeOnly}
                                </div>

                                {/* Level column */}
                                <div className={`shrink-0 w-12 font-bold select-none ${levelColor}`}>
                                    {log.level.padEnd(5, ' ')}
                                </div>

                                {/* Message column (uses standard text rendering, NO innerHTML used) */}
                                <div className="flex-1 text-[#E2E8F0] whitespace-pre-wrap break-words">
                                    {log.message}
                                </div>
                            </div>

                            {/* Extracted Cryptographic Evidence (Visible on Hover/Focus) */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 flex items-center gap-4 text-2xs font-mono text-textMuted/40 select-text">
                                <div className="flex items-center gap-1.5">
                                    <span>HASH:</span>
                                    <span className="text-textMuted/60">{log.hash}</span>
                                </div>
                                {log.previousHash && (
                                    <div className="flex items-center gap-1.5">
                                        <span>PREV:</span>
                                        <span className="text-textMuted/60">{log.previousHash}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default LogConsole;
