"use client";

import { useState } from "react";
import {
    Panel,
    PanelHeader,
    PanelContent,
    Tabs,
    StatusBadge
} from "@/components/dashboard/ControlPanelComponents";
import {
    ClockIcon,
    DocumentTextIcon,
    ShieldExclamationIcon,
    CheckBadgeIcon,
    CommandLineIcon,
    CurrencyDollarIcon
} from "@heroicons/react/24/outline";

export function DashboardLayout() {
    return (
        <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col gap-4 overflow-hidden p-4">

            {/* Top Bar / Cost Indicator & Top-level Status */}
            <div className="flex gap-4 h-24 shrink-0">
                <Panel className="flex-1 bg-surface flex flex-row items-center p-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                        <CurrencyDollarIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-textMuted uppercase tracking-wider font-semibold">Monthly Spend Anomaly</p>
                        <h2 className="text-2xl font-bold text-textMain mt-0.5">$0.00</h2>
                    </div>
                    <div className="ml-auto">
                        <StatusBadge status="success" label="On Track" className="px-3 py-1.5 text-sm" />
                    </div>
                </Panel>

                <Panel className="flex-1 bg-surface flex flex-row items-center p-4">
                    <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mr-4">
                        <CheckBadgeIcon className="h-6 w-6 text-successText" />
                    </div>
                    <div>
                        <p className="text-xs text-textMuted uppercase tracking-wider font-semibold">Overall Compliance</p>
                        <h2 className="text-2xl font-bold text-textMain mt-0.5">99.9%</h2>
                    </div>
                    <div className="ml-auto">
                        <StatusBadge status="success" label="Healthy" className="px-3 py-1.5 text-sm" />
                    </div>
                </Panel>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Left Column (Context & Lifecycle) */}
                <div className="w-[30%] flex flex-col gap-4 h-full min-w-[320px]">

                    {/* Context Viewer */}
                    <Panel className="flex-1 flex flex-col min-h-0">
                        <PanelHeader
                            title="Context Viewer"
                            action={<StatusBadge status="idle" label="Live" />}
                        />
                        <PanelContent noPadding className="flex flex-col">
                            <Tabs
                                tabs={[
                                    { id: "details", label: "Details", content: <div className="p-4 text-sm text-textSub">Select a resource to view context details.</div> },
                                    { id: "tags", label: "Tags", content: <div className="p-4 text-sm text-textSub">No tags available.</div>, badge: 0 }
                                ]}
                            />
                        </PanelContent>
                    </Panel>

                    {/* Execution Lifecycle */}
                    <Panel className="flex-[1.5] flex flex-col min-h-0">
                        <PanelHeader
                            title="Execution Lifecycle"
                            action={
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-textMuted" />
                                    <span className="text-xs text-textMuted font-mono">00:00.00</span>
                                </div>
                            }
                        />
                        <PanelContent className="bg-background">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-border bg-background z-10" />
                                    <div>
                                        <p className="text-sm font-medium text-textMain">Initialization</p>
                                        <p className="text-xs text-textMuted font-mono mt-0.5">Pending</p>
                                    </div>
                                </div>
                            </div>
                        </PanelContent>
                    </Panel>

                </div>

                {/* Center / Right Column (Tabs & Logs) */}
                <div className="flex-1 flex flex-col gap-4 h-full min-w-0">

                    {/* Main Operations Area (Plan, Execution, Risk) */}
                    <Panel className="flex-[2] flex flex-col min-h-0">
                        <Tabs
                            className="bg-surface h-full"
                            tabs={[
                                {
                                    id: "plan",
                                    label: "Plan",
                                    content: (
                                        <div className="p-6 h-full flex flex-col items-center justify-center text-center">
                                            <DocumentTextIcon className="h-12 w-12 text-textMuted/50 mb-4" />
                                            <h3 className="text-sm font-semibold text-textMain">No Active Plan</h3>
                                            <p className="text-xs text-textSub max-w-sm mt-1">A plan will be generated here when an execution context is initialized.</p>
                                        </div>
                                    )
                                },
                                {
                                    id: "execution",
                                    label: "Execution",
                                    content: (
                                        <div className="p-6 h-full flex flex-col items-center justify-center text-center">
                                            <CommandLineIcon className="h-12 w-12 text-textMuted/50 mb-4" />
                                            <h3 className="text-sm font-semibold text-textMain">Awaiting Execution</h3>
                                        </div>
                                    )
                                },
                                {
                                    id: "risk",
                                    label: "Risk Assessment",
                                    badge: "0",
                                    content: (
                                        <div className="p-6 h-full flex flex-col items-center justify-center text-center">
                                            <ShieldExclamationIcon className="h-12 w-12 text-successText mb-4 opacity-50" />
                                            <h3 className="text-sm font-semibold text-textMain">No Risks Detected</h3>
                                        </div>
                                    )
                                }
                            ]}
                        />
                    </Panel>

                    {/* Bottom Split (Approval & Logs/Citations) */}
                    <div className="flex-1 flex gap-4 min-h-0">

                        {/* Validation/Approval Panel */}
                        <Panel className="flex-1 flex flex-col min-h-0 border-warning/30">
                            <PanelHeader
                                title="Validation Gate"
                                className="bg-warning/5 border-warning/20"
                                status={<StatusBadge status="warning" label="Awaiting Input" />}
                            />
                            <PanelContent className="flex flex-col items-center justify-center text-center bg-warning/5">
                                <p className="text-sm text-textMain font-medium mb-4">Manual approval required to proceed.</p>
                                <div className="flex gap-3">
                                    <button disabled className="btn btn-sm btn-primary opacity-50 cursor-not-allowed">Approve</button>
                                    <button disabled className="btn btn-sm bg-background border border-border opacity-50 cursor-not-allowed">Reject</button>
                                </div>
                            </PanelContent>
                        </Panel>

                        {/* Logs Console / Citations */}
                        <Panel className="flex-[2] flex flex-col min-h-0">
                            <PanelHeader
                                title="System Output"
                                action={<div className="flex gap-2">
                                    <button className="text-xs text-textMuted hover:text-textMain">Clear</button>
                                    <button className="text-xs text-textMuted hover:text-textMain">Copy</button>
                                </div>}
                            />
                            <Tabs
                                className="h-full bg-surface"
                                tabs={[
                                    {
                                        id: "logs",
                                        label: "Console Logs",
                                        content: (
                                            <div className="bg-[#1e1e1e] h-full p-4 font-mono text-xs overflow-auto">
                                                <div className="text-successText">{"[SYSTEM] Ready for execution context."}</div>
                                            </div>
                                        )
                                    },
                                    {
                                        id: "citations",
                                        label: "Citations",
                                        badge: 0,
                                        content: (
                                            <div className="p-4 text-xs text-textMuted h-full flex items-center justify-center">
                                                No citations needed for current context.
                                            </div>
                                        )
                                    }
                                ]}
                            />
                        </Panel>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardLayout;
