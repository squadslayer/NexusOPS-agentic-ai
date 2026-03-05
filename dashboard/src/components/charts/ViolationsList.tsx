'use client';

import { formatDate } from "@/lib/utils";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

type Violation = {
    id: string;
    rule: string;
    resource: string;
    account: string;
    severity: Severity;
    detectedAt: string;
};

const SEVERITY_BADGE: Record<Severity, string> = {
    CRITICAL: "badge-danger",
    HIGH: "badge bg-orange-500/20 text-orange-400",
    MEDIUM: "badge-warning",
    LOW: "badge-neutral",
};

interface Props {
    violations: Violation[];
}

export function ViolationsList({ violations }: Props) {
    return (
        <div className="overflow-auto h-full">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-border">
                        <th className="text-left pb-2 pr-3 font-semibold uppercase tracking-wide text-textMuted">
                            Severity
                        </th>
                        <th className="text-left pb-2 pr-3 font-semibold uppercase tracking-wide text-textMuted">
                            Rule / Resource
                        </th>
                        <th className="text-left pb-2 font-semibold uppercase tracking-wide text-textMuted hidden xl:table-cell">
                            Detected
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                    {violations.map((v) => (
                        <tr key={v.id} className="hover:bg-surfaceHover transition-colors">
                            <td className="py-2 pr-3 align-top">
                                <span className={SEVERITY_BADGE[v.severity]}>{v.severity}</span>
                            </td>
                            <td className="py-2 pr-3 align-top">
                                <p className="text-textMain font-medium leading-snug">{v.rule}</p>
                                <p className="text-textMuted font-mono mt-0.5 truncate max-w-[220px]">
                                    {v.resource}
                                </p>
                            </td>
                            <td className="py-2 text-textMuted hidden xl:table-cell align-top whitespace-nowrap">
                                {formatDate(v.detectedAt)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
