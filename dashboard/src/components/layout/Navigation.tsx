'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    HomeIcon,
    ExclamationTriangleIcon,
    CloudIcon,
    EyeIcon,
    CpuChipIcon,
    ChartBarSquareIcon,
    ShieldCheckIcon,
    ServerStackIcon,
} from "@heroicons/react/24/outline";

interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
    {
        heading: "Overview",
        items: [
            { label: "Home", href: "/", icon: HomeIcon },
            { label: "Dashboard", href: "/dashboard", icon: ChartBarSquareIcon },
            { label: "Executions", href: "/executions", icon: CpuChipIcon },
            { label: "Repositories", href: "/repositories", icon: ServerStackIcon },
        ],
    },
    {
        heading: "Governance",
        items: [
            { label: "Problem Statement", href: "/problem", icon: ExclamationTriangleIcon },
            { label: "AWS Resources", href: "/aws", icon: CloudIcon },
            { label: "Vision", href: "/vision", icon: EyeIcon },
            { label: "Use Cases", href: "/use", icon: CpuChipIcon },
        ],
    },
    {
        heading: "Inventory",
        items: [
            { label: "Resources", href: "/resources", icon: ServerStackIcon },
        ],
    },
    {
        heading: "Compliance & Costs",
        items: [
            { label: "Policy Violations", href: "/compliance", icon: ShieldCheckIcon },
            { label: "Cost Anomalies", href: "/costs", icon: ChartBarSquareIcon },
        ],
    },
];

export function Navigation() {
    const pathname = usePathname();
    const [pendingApprovals, setPendingApprovals] = useState(0);

    useEffect(() => {
        try {
            const bffUrl = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:8000";
            const res = await fetch(`${bffUrl}/dashboard/stats`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('nexusops_token') || ''}` }
            });
            if (res.ok) {
                const json = await res.json();
                setPendingApprovals(json.data.pending_approvals || 0);
            }
        } catch (e) { }
    };
    fetchStats();
    // Poll every 15 seconds to keep the badge up to date
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
}, []);

return (
    <aside
        className="
        w-60 flex-shrink-0 h-full flex flex-col
        bg-surface border-r border-border
        overflow-y-auto
      "
    >
        {/* Brand */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border shrink-0">
            <ShieldCheckIcon className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-base font-semibold tracking-tight text-textMain">
                Nexus<span className="text-primary">OPS</span>
            </span>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 py-4 px-2 space-y-6">
            {NAV_GROUPS.map((group) => (
                <div key={group.heading}>
                    <p className="section-label px-2 mb-1">{group.heading}</p>
                    <ul className="space-y-0.5">
                        {group.items.map((item) => {
                            const isActive =
                                item.href === "/"
                                    ? pathname === "/"
                                    : pathname.startsWith(item.href);
                            const Icon = item.icon;

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`
                        flex items-center gap-3 px-2 py-2 rounded text-sm font-medium
                        transition-colors duration-100
                        ${isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-textSub hover:bg-surfaceHover hover:text-textMain"
                                            }
                      `}
                                    >
                                        <Icon
                                            className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-textMuted"
                                                }`}
                                            aria-hidden
                                        />
                                        {item.label}
                                        {item.label === "Executions" && pendingApprovals > 0 && (
                                            <span className="ml-auto bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                                {pendingApprovals}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>

        {/* Footer / Version */}
        <div className="shrink-0 px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-2xs text-textMuted font-mono">v1.0.0</span>
            <span className="status-dot bg-successText" title="All systems operational" />
        </div>
    </aside>
);
}
