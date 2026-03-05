"use client";

import { useMemo, useState } from "react";
import { DocumentTextIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { formatNumber } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CitationMatch = {
    exactText: string;
    lineNumber?: number;
};

export type RetrievedDocument = {
    id: string;
    title: string;
    sourceType: "WIKI" | "JIRA" | "SLACK" | "GITHUB" | "POLICY";
    url?: string;
    confidenceScore: number;
    matches: CitationMatch[];
    retrievedAt: string;
};

interface CitationPanelProps {
    documents: RetrievedDocument[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CitationPanel({ documents }: CitationPanelProps) {
    const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedDocs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const sortedDocuments = useMemo(() => {
        return [...documents].sort((a, b) => b.confidenceScore - a.confidenceScore);
    }, [documents]);

    if (!documents || documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border-y border-border">
                <DocumentTextIcon className="h-8 w-8 text-textMuted/50 mb-3" />
                <p className="text-sm text-textMuted font-medium">No citations retrieved for this context.</p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-surface border-y border-border">
                        <th className="py-3 px-4 text-xs font-semibold text-textMuted uppercase tracking-wide w-8"></th>
                        <th className="py-3 px-4 text-xs font-semibold text-textMuted uppercase tracking-wide">Source Document</th>
                        <th className="py-3 px-4 text-xs font-semibold text-textMuted uppercase tracking-wide w-32">Type</th>
                        <th className="py-3 px-4 text-xs font-semibold text-textMuted uppercase tracking-wide w-28 text-right">Confidence</th>
                        <th className="py-3 px-4 text-xs font-semibold text-textMuted uppercase tracking-wide w-24 text-right">Matches</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-divider bg-background">
                    {sortedDocuments.map((doc) => {
                        const isExpanded = expandedDocs.has(doc.id);

                        // Color code confidence score
                        let scoreColor = "text-successText bg-success/10 border-success/20";
                        if (doc.confidenceScore < 0.6) scoreColor = "text-dangerText bg-danger/10 border-danger/20";
                        else if (doc.confidenceScore < 0.85) scoreColor = "text-warningText bg-warning/10 border-warning/20";

                        return (
                            <React.Fragment key={doc.id}>
                                {/* Main Row */}
                                <tr
                                    className={`hover:bg-surfaceHover transition-colors cursor-pointer ${isExpanded ? "bg-surface/30" : ""}`}
                                    onClick={() => toggleExpand(doc.id)}
                                >
                                    <td className="py-3 px-4 text-textMuted">
                                        {isExpanded ? (
                                            <ChevronUpIcon className="h-4 w-4" />
                                        ) : (
                                            <ChevronDownIcon className="h-4 w-4" />
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-textMain line-clamp-1" title={doc.title}>
                                                {doc.title}
                                            </span>
                                            {doc.url && (
                                                <a
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-primary hover:underline line-clamp-1 mt-0.5"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {doc.url}
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="badge badge-neutral text-2xs font-mono">{doc.sourceType}</span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded border text-xs font-mono ${scoreColor}`}>
                                            {formatNumber(doc.confidenceScore * 100)}%
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <span className="text-xs font-medium text-textSub bg-surface px-2 py-1 rounded">
                                            {doc.matches.length}
                                        </span>
                                    </td>
                                </tr>

                                {/* Expanded Matches Row */}
                                {isExpanded && (
                                    <tr className="bg-surface/20">
                                        <td colSpan={5} className="p-0 border-t border-divider">
                                            <div className="px-12 py-4 space-y-3">
                                                <h4 className="text-xs font-semibold text-textMuted uppercase tracking-wide mb-2">
                                                    Extracted References
                                                </h4>

                                                {doc.matches.length === 0 ? (
                                                    <p className="text-sm text-textSub italic">No specific snippets extracted.</p>
                                                ) : (
                                                    <ul className="space-y-2">
                                                        {doc.matches.map((match, idx) => (
                                                            <li key={idx} className="flex flex-col sm:flex-row gap-2 items-start py-2 px-3 rounded border border-border bg-background">
                                                                <div className="shrink-0 mt-0.5">
                                                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary text-2xs font-bold font-mono">
                                                                        {idx + 1}
                                                                    </span>
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm text-textMain font-mono font-medium leading-relaxed break-words whitespace-pre-wrap">
                                                                        "{match.exactText}"
                                                                    </p>
                                                                </div>

                                                                {match.lineNumber !== undefined && (
                                                                    <div className="shrink-0">
                                                                        <span className="text-xs text-textMuted font-mono whitespace-nowrap">
                                                                            Line {match.lineNumber}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default CitationPanel;
