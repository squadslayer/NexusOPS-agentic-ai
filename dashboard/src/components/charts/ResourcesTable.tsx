'use client';

import { useState, useMemo } from "react";
import { MagnifyingGlassIcon, FunnelIcon } from "@heroicons/react/24/outline";

type Status = "compliant" | "non-compliant" | "unknown";

export type ResourceItem = {
    id: string;
    name: string;
    type: string;
    region: string;
    account: string;
    status: Status;
};

const STATUS_BADGE: Record<Status, string> = {
    "compliant": "badge-success",
    "non-compliant": "badge-danger",
    "unknown": "badge-neutral",
};

interface Props {
    resources: ResourceItem[];
}

export function ResourcesTable({ resources }: Props) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");

    // Build unique type options from the data
    const typeOptions = useMemo(() => {
        const types = Array.from(new Set(resources.map((r) => r.type))).sort();
        return ["all", ...types];
    }, [resources]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return resources.filter((r) => {
            const matchSearch =
                !q ||
                r.name.toLowerCase().includes(q) ||
                r.id.toLowerCase().includes(q) ||
                r.account.toLowerCase().includes(q) ||
                r.region.toLowerCase().includes(q);
            const matchStatus = statusFilter === "all" || r.status === statusFilter;
            const matchType = typeFilter === "all" || r.type === typeFilter;
            return matchSearch && matchStatus && matchType;
        });
    }, [resources, search, statusFilter, typeFilter]);

    const counts = useMemo(() => ({
        compliant: resources.filter((r) => r.status === "compliant").length,
        nonCompliant: resources.filter((r) => r.status === "non-compliant").length,
        unknown: resources.filter((r) => r.status === "unknown").length,
    }), [resources]);

    return (
        <div className="flex flex-col gap-4">
            {/* Summary Pills */}
            <div className="flex flex-wrap gap-3">
                <SummaryPill label="Compliant" count={counts.compliant} colorClass="text-successText bg-success/10 border-success/30" />
                <SummaryPill label="Non-Compliant" count={counts.nonCompliant} colorClass="text-dangerText bg-danger/10 border-danger/30" />
                <SummaryPill label="Unknown" count={counts.unknown} colorClass="text-textMuted bg-border border-border" />
                <span className="ml-auto text-xs text-textMuted self-center">
                    {filtered.length} of {resources.length} resources
                </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted pointer-events-none" aria-hidden />
                    <input
                        type="text"
                        placeholder="Search by name, ID, account…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="
                            w-full pl-8 pr-3 py-2 text-sm rounded
                            bg-surface border border-border
                            text-textMain placeholder:text-textMuted
                            focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                            transition-colors
                        "
                    />
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-1.5">
                    <FunnelIcon className="h-3.5 w-3.5 text-textMuted shrink-0" aria-hidden />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="
                            text-sm rounded px-2 py-2
                            bg-surface border border-border text-textSub
                            focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                        "
                        aria-label="Filter by status"
                    >
                        <option value="all">All Statuses</option>
                        <option value="compliant">Compliant</option>
                        <option value="non-compliant">Non-Compliant</option>
                        <option value="unknown">Unknown</option>
                    </select>
                </div>

                {/* Type filter */}
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="
                        text-sm rounded px-2 py-2
                        bg-surface border border-border text-textSub
                        focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                    "
                    aria-label="Filter by resource type"
                >
                    {typeOptions.map((t) => (
                        <option key={t} value={t}>
                            {t === "all" ? "All Types" : t}
                        </option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-background">
                                {["Name / ID", "Type", "Region", "Account", "Status"].map((h) => (
                                    <th
                                        key={h}
                                        className="text-left px-4 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide whitespace-nowrap"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-divider">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-textMuted text-sm">
                                        No resources match your filters.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((r) => (
                                    <tr key={r.id} className="hover:bg-surfaceHover transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-textMain">{r.name}</p>
                                            <p className="text-2xs font-mono text-textMuted mt-0.5">{r.id}</p>
                                        </td>
                                        <td className="px-4 py-3 text-textSub">{r.type}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-textSub">{r.region}</td>
                                        <td className="px-4 py-3 text-textSub">{r.account}</td>
                                        <td className="px-4 py-3">
                                            <span className={STATUS_BADGE[r.status]}>
                                                {r.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function SummaryPill({
    label,
    count,
    colorClass,
}: {
    label: string;
    count: number;
    colorClass: string;
}) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium ${colorClass}`}>
            <span className="text-base font-semibold">{count}</span>
            <span>{label}</span>
        </div>
    );
}
