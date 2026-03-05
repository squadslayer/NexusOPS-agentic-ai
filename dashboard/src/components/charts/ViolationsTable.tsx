'use client';

import { useState, useMemo } from "react";
import { formatDate } from "@/lib/utils";
import { MagnifyingGlassIcon, FunnelIcon } from "@heroicons/react/24/outline";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ViolationItem = {
    id: string;
    rule: string;
    resource: string;
    account: string;
    region: string;
    severity: Severity;
    detectedAt: string;
};

const SEVERITY_BADGE: Record<Severity, string> = {
    CRITICAL: "badge-danger",
    HIGH: "badge bg-orange-500/20 text-orange-400",
    MEDIUM: "badge-warning",
    LOW: "badge-neutral",
};

const SEVERITY_ORDER: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
};

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

interface Props {
    violations: ViolationItem[];
}

export function ViolationsTable({ violations }: Props) {
    const [search, setSearch] = useState("");
    const [filterSeverity, setFilterSeverity] = useState<"All" | Severity>("All");
    const [filterAccount, setFilterAccount] = useState("All");

    const accounts = useMemo(
        () => ["All", ...Array.from(new Set(violations.map((v) => v.account)))],
        [violations]
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return violations
            .filter((v) => {
                const matchSearch =
                    !q ||
                    v.rule.toLowerCase().includes(q) ||
                    v.resource.toLowerCase().includes(q) ||
                    v.account.toLowerCase().includes(q);
                const matchSev = filterSeverity === "All" || v.severity === filterSeverity;
                const matchAcc = filterAccount === "All" || v.account === filterAccount;
                return matchSearch && matchSev && matchAcc;
            })
            .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    }, [violations, search, filterSeverity, filterAccount]);

    // Summary counts
    const counts = useMemo(() => {
        const c: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        violations.forEach((v) => c[v.severity]++);
        return c;
    }, [violations]);

    const PILL_STYLES: Record<Severity, string> = {
        CRITICAL: "bg-danger/20 text-dangerText border border-danger/30",
        HIGH: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
        MEDIUM: "bg-warning/20 text-warningText border border-warning/30",
        LOW: "bg-border text-textSub border border-border",
    };

    return (
        <div className="space-y-4">
            {/* Summary Pills */}
            <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((sev) => (
                    <button
                        key={sev}
                        type="button"
                        onClick={() =>
                            setFilterSeverity((prev) => (prev === sev ? "All" : sev))
                        }
                        className={`
                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold
                            transition-all cursor-pointer
                            ${PILL_STYLES[sev]}
                            ${filterSeverity === sev ? "ring-2 ring-offset-1 ring-offset-background ring-current" : ""}
                        `}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${sev === "CRITICAL" ? "bg-dangerText" : sev === "HIGH" ? "bg-orange-400" : sev === "MEDIUM" ? "bg-warningText" : "bg-textSub"}`}
                        />
                        {sev}
                        <span className="ml-0.5 font-mono">{counts[sev]}</span>
                    </button>
                ))}
                {filtered.length !== violations.length && (
                    <span className="text-xs text-textMuted self-center ml-auto">
                        Showing {filtered.length} of {violations.length}
                    </span>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-textMuted pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search rule, resource, or account…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="
                            w-full pl-8 pr-3 py-1.5 text-xs rounded border border-border
                            bg-background text-textMain placeholder:text-textMuted
                            focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                            transition-colors
                        "
                    />
                </div>

                {/* Severity filter */}
                <div className="relative">
                    <FunnelIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-textMuted pointer-events-none" />
                    <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value as "All" | Severity)}
                        className="
                            pl-6 pr-6 py-1.5 text-xs rounded border border-border
                            bg-background text-textMain appearance-none
                            focus:outline-none focus:ring-1 focus:ring-primary
                        "
                    >
                        <option value="All">All Severities</option>
                        {SEVERITIES.map((s) => (
                            <option key={s}>{s}</option>
                        ))}
                    </select>
                </div>

                {/* Account filter */}
                <div className="relative">
                    <FunnelIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-textMuted pointer-events-none" />
                    <select
                        value={filterAccount}
                        onChange={(e) => setFilterAccount(e.target.value)}
                        className="
                            pl-6 pr-6 py-1.5 text-xs rounded border border-border
                            bg-background text-textMain appearance-none
                            focus:outline-none focus:ring-1 focus:ring-primary
                        "
                    >
                        {accounts.map((a) => (
                            <option key={a}>{a}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="card p-0 overflow-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-border bg-background">
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted whitespace-nowrap">
                                Severity
                            </th>
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted">
                                Rule / Resource
                            </th>
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted hidden lg:table-cell whitespace-nowrap">
                                Account
                            </th>
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted hidden xl:table-cell whitespace-nowrap">
                                Region
                            </th>
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted hidden xl:table-cell whitespace-nowrap">
                                Detected
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                        {filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-4 py-8 text-center text-textMuted"
                                >
                                    No violations match filters.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((v) => (
                                <tr
                                    key={v.id}
                                    className="hover:bg-surfaceHover transition-colors"
                                >
                                    <td className="px-4 py-3 align-top whitespace-nowrap">
                                        <span className={SEVERITY_BADGE[v.severity]}>
                                            {v.severity}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <p className="text-textMain font-medium leading-snug">
                                            {v.rule}
                                        </p>
                                        <p
                                            className="text-textMuted font-mono mt-0.5 truncate max-w-[260px]"
                                            title={v.resource}
                                        >
                                            {v.resource}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 align-top text-textSub hidden lg:table-cell">
                                        {v.account}
                                    </td>
                                    <td className="px-4 py-3 align-top text-textMuted font-mono hidden xl:table-cell whitespace-nowrap">
                                        {v.region}
                                    </td>
                                    <td className="px-4 py-3 align-top text-textMuted hidden xl:table-cell whitespace-nowrap">
                                        {formatDate(v.detectedAt)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
