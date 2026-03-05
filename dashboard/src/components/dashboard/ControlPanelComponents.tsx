"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── Status Badge ─────────────────────────────────────────────────────────────

export type StatusType = "idle" | "pending" | "success" | "warning" | "danger" | "neutral";

interface StatusBadgeProps {
    status: StatusType;
    label: string;
    className?: string;
}

const STATUS_VARIANTS: Record<StatusType, string> = {
    idle: "badge-neutral text-textMuted",
    pending: "badge-warning",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    neutral: "badge-neutral",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
    return (
        <span className={cn(STATUS_VARIANTS[status], className)}>
            {status === "pending" && (
                <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            )}
            {label}
        </span>
    );
}

// ─── Panel Layout ─────────────────────────────────────────────────────────────

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <section className={cn("card flex flex-col p-0 overflow-hidden", className)}>
            {children}
        </section>
    );
}

export function PanelHeader({
    title,
    action,
    status,
    className
}: {
    title: string;
    action?: React.ReactNode;
    status?: React.ReactNode;
    className?: string;
}) {
    return (
        <header className={cn("px-4 py-3 border-b border-border bg-surface flex items-center justify-between shrink-0", className)}>
            <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-textMain">{title}</h3>
                {status && <div>{status}</div>}
            </div>
            {action && <div>{action}</div>}
        </header>
    );
}

export function PanelContent({ children, className, noPadding = false }: { children: React.ReactNode; className?: string; noPadding?: boolean }) {
    return (
        <div className={cn("flex-1 overflow-auto", !noPadding && "p-4", className)}>
            {children}
        </div>
    );
}

// ─── Tabs System ──────────────────────────────────────────────────────────────

export interface Tab {
    id: string;
    label: string;
    content: React.ReactNode;
    badge?: number | string;
}

interface TabsProps {
    tabs: Tab[];
    defaultTab?: string;
    className?: string;
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id);

    const activeContent = tabs.find(t => t.id === activeTab)?.content;

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex border-b border-border px-2 bg-surface shrink-0">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2",
                                isActive
                                    ? "border-primary text-primary"
                                    : "border-transparent text-textSub hover:text-textMain hover:border-borderHover"
                            )}
                        >
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-2xs font-mono",
                                    isActive ? "bg-primary/10 text-primary" : "bg-border text-textMuted"
                                )}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className="flex-1 overflow-auto">
                {activeContent}
            </div>
        </div>
    );
}

