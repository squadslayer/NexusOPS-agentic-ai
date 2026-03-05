'use client';

import { useState, useMemo } from "react";
import { MagnifyingGlassIcon, FunnelIcon } from "@heroicons/react/24/outline";

export type CostAnomaly = {
    id: string;
    service: string;
    account: string;
    region: string;
    expectedUsd: number;
    actualUsd: number;
    detectedAt: string;
    description: string;
};

function formatUsd(n: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);
}

function formatPercent(expected: number, actual: number) {
    if (expected === 0) return "N/A";
    const pct = ((actual - expected) / expected) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}

interface Props {
    anomalies: CostAnomaly[];
}

export function CostAnomaliesTable({ anomalies }: Props) {
    const [search, setSearch] = useState("");
    const [filterAccount, setFilterAccount] = useState("All");
    const [filterService, setFilterService] = useState("All");

    const accounts = useMemo(
        () => ["All", ...Array.from(new Set(anomalies.map((a) => a.account)))],
        [anomalies]
    );
    const services = useMemo(
        () => ["All", ...Array.from(new Set(anomalies.map((a) => a.service)))],
        [anomalies]
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return anomalies.filter((a) => {
            const matchSearch =
                !q ||
                a.service.toLowerCase().includes(q) ||
                a.account.toLowerCase().includes(q) ||
                a.description.toLowerCase().includes(q);
            const matchAcc = filterAccount === "All" || a.account === filterAccount;
            const matchSvc = filterService === "All" || a.service === filterService;
            return matchSearch && matchAcc && matchSvc;
        });
    }, [anomalies, search, filterAccount, filterService]);

    // Summary totals
    const totalActual = useMemo(() => anomalies.reduce((s, a) => s + a.actualUsd, 0), [anomalies]);
    const totalExpected = useMemo(() => anomalies.reduce((s, a) => s + a.expectedUsd, 0), [anomalies]);
    const totalDelta = totalActual - totalExpected;
    const accountsAffected = useMemo(
        () => new Set(anomalies.map((a) => a.account)).size,
        [anomalies]
    );

    return (
        <div className="space-y-4">
            {/* Summary Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card space-y-1">
                    <p className="text-2xs text-textMuted uppercase tracking-wide font-semibold">Anomalies</p>
                    <p className="text-2xl font-semibold text-textMain">{anomalies.length}</p>
                </div>
                <div className="card space-y-1">
                    <p className="text-2xs text-textMuted uppercase tracking-wide font-semibold">Accounts Affected</p>
                    <p className="text-2xl font-semibold text-textMain">{accountsAffected}</p>
                </div>
                <div className="card space-y-1">
                    <p className="text-2xs text-textMuted uppercase tracking-wide font-semibold">Actual Spend</p>
                    <p className="text-2xl font-semibold text-textMain">{formatUsd(totalActual)}</p>
                </div>
                <div className="card space-y-1">
                    <p className="text-2xs text-textMuted uppercase tracking-wide font-semibold">Anomalous Delta</p>
                    <p className={`text-2xl font-semibold ${totalDelta > 0 ? "text-dangerText" : "text-successText"}`}>
                        {totalDelta > 0 ? "+" : ""}{formatUsd(totalDelta)}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-textMuted pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search service, account, or description…"
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
                <div className="relative">
                    <FunnelIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-textMuted pointer-events-none" />
                    <select
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                        className="pl-6 pr-6 py-1.5 text-xs rounded border border-border bg-background text-textMain appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        {services.map((s) => (
                            <option key={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div className="relative">
                    <FunnelIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-textMuted pointer-events-none" />
                    <select
                        value={filterAccount}
                        onChange={(e) => setFilterAccount(e.target.value)}
                        className="pl-6 pr-6 py-1.5 text-xs rounded border border-border bg-background text-textMain appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
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
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted whitespace-nowrap">Service</th>
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted hidden lg:table-cell whitespace-nowrap">Account</th>
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted hidden xl:table-cell whitespace-nowrap">Region</th>
                            <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide text-textMuted whitespace-nowrap">Expected</th>
                            <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide text-textMuted whitespace-nowrap">Actual</th>
                            <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide text-textMuted whitespace-nowrap">Delta</th>
                            <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-textMuted hidden 2xl:table-cell">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-textMuted">
                                    No anomalies match filters.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((a) => {
                                const delta = a.actualUsd - a.expectedUsd;
                                const pct = formatPercent(a.expectedUsd, a.actualUsd);
                                const isOver = delta > 0;
                                return (
                                    <tr key={a.id} className="hover:bg-surfaceHover transition-colors">
                                        <td className="px-4 py-3 align-top">
                                            <p className="font-medium text-textMain">{a.service}</p>
                                            <p className="text-textMuted font-mono mt-0.5">{a.region}</p>
                                        </td>
                                        <td className="px-4 py-3 align-top text-textSub hidden lg:table-cell">{a.account}</td>
                                        <td className="px-4 py-3 align-top text-textMuted font-mono hidden xl:table-cell whitespace-nowrap">{a.region}</td>
                                        <td className="px-4 py-3 align-top text-right text-textSub font-mono whitespace-nowrap">
                                            {formatUsd(a.expectedUsd)}
                                        </td>
                                        <td className="px-4 py-3 align-top text-right text-textMain font-mono font-semibold whitespace-nowrap">
                                            {formatUsd(a.actualUsd)}
                                        </td>
                                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                                            <span className={`font-mono font-semibold ${isOver ? "text-dangerText" : "text-successText"}`}>
                                                {isOver ? "+" : ""}{formatUsd(delta)}
                                            </span>
                                            <br />
                                            <span className={`text-2xs ${isOver ? "text-dangerText/70" : "text-successText/70"}`}>
                                                {pct}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 align-top text-textSub hidden 2xl:table-cell max-w-[240px] truncate" title={a.description}>
                                            {a.description}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
