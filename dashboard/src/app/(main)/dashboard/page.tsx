"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { apiFetch } from "@/lib/api";
import { useRepositories, type Repository as Repo } from "@/hooks/useRepositories";
import ExecutionList from "@/components/executions/ExecutionList";
import {
    ServerStackIcon,
    ArrowDownTrayIcon,
    PlusIcon,
    ChatBubbleLeftRightIcon,
    PaperAirplaneIcon,
    XMarkIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    LockClosedIcon,
    GlobeAltIcon,
} from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────────────────────────



type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
};

// ─── Chat Panel Component ─────────────────────────────────────────────────────

function ChatPanel({ isOpen, onClose, repos, onExecutionStarted }: { isOpen: boolean; onClose: () => void; repos: Repo[]; onExecutionStarted?: () => void }) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `Welcome to NexusOps! You have ${repos.length} ${repos.length === 1 ? "repository" : "repositories"} linked. Ask me about your cloud governance, compliance, or repository analysis.`,
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !repos.length) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        try {
            // CALL REAL BFF EXECUTION
            const repo = repos[0]; // For now, use the first repo if multiple exist
            const res = await apiFetch('/executions/start', {
                method: 'POST',
                body: JSON.stringify({
                    repo_id: repo.id,
                    repository_url: repo.html_url,
                    input: {
                        prompt: userMsg.content,
                        query: userMsg.content
                    }
                })
            });

            if (res.ok) {
                const data = await res.json();
                console.log("EXECUTION START RESPONSE:", data);

                // Deep extraction for the ID
                const execId = data.data?.execution_id || data.meta?.execution_id || data.execution_id || data.data?.id || "not-found";

                // Debug alert to help identify the structure
                if (execId === "not-found") {
                    alert("DEBUG: Response structure unexpected. Body: " + JSON.stringify(data));
                }

                const assistantMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: `Success! Execution \`${execId}\` started.\n\nNexusOPS is now triggering the Ask → Retrieve → Reason → Act loop. The ingestion pipeline will clone and analyze your repository (\`${repo.name}\`) just-in-time.\n\nYou can track the progress in the "Recent Executions" section! 🥂`,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, assistantMsg]);

                // TRIGGER REFRESH
                if (onExecutionStarted) onExecutionStarted();
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to start execution");
            }
        } catch (err: any) {
            setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `Error: ${err.message || "Something went wrong"}. Please ensure your Lambda is reachable.`,
                timestamp: new Date(),
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-96 max-h-[32rem] bg-surface border border-border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/90">
                <div className="flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold text-textMain">NexusOps Assistant</span>
                </div>
                <button onClick={onClose} className="text-textMuted hover:text-textMain transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[16rem]">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${msg.role === "user"
                                ? "bg-primary text-white rounded-br-none"
                                : "bg-background text-textMain border border-border rounded-bl-none"
                                }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMuted">
                            <span className="inline-flex gap-1">
                                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                            </span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-surface/90">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="flex items-center gap-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your infrastructure..."
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-textMain placeholder:text-textMuted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { repositories: repos, isLoading } = useRepositories();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [recentExecutions, setRecentExecutions] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);

    const refreshData = useCallback(async () => {
        try {
            const [statsRes, execsRes] = await Promise.all([
                apiFetch('/dashboard/stats'),
                apiFetch('/executions')
            ]);

            if (statsRes.ok) {
                const json = await statsRes.json();
                setStats(json.data);
            }

            if (execsRes.ok) {
                const json = await execsRes.json();
                const sorted = (json.data || []).sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setRecentExecutions(sorted.slice(0, 5));
            }
        } catch (err) {
            console.error("Failed to load dashboard data", err);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const handleExport = () => {
        if (repos.length === 0) {
            alert("No repositories connected to export.");
            return;
        }
        const lines = [
            "NexusOps — Repository Report",
            `Generated: ${new Date().toISOString()}`,
            `Total Repositories: ${repos.length}`,
            "",
            "Connected Repositories:",
            ...repos.map(
                (r, i) =>
                    `  ${i + 1}. ${r.name} (${r.private ? "Private" : "Public"}) — ${r.html_url}`
            ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nexusops-report.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Loading state ───
    if (isLoading) {
        return (
            <PageContainer heading="Dashboard" description="Loading your workspace...">
                <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                        <ServerStackIcon className="h-10 w-10 text-textMuted animate-pulse" />
                        <p className="text-sm text-textMuted">Checking connected repositories...</p>
                    </div>
                </div>
            </PageContainer>
        );
    }

    // ─── No repos connected — empty state ───
    if (repos.length === 0) {
        return (
            <PageContainer
                heading="Dashboard"
                description="Real-time overview of your cloud governance posture."
            >
                <div className="flex flex-col items-center justify-center py-20 gap-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <ServerStackIcon className="h-10 w-10 text-primary" />
                    </div>
                    <div className="text-center max-w-md">
                        <h2 className="text-xl font-semibold text-textMain mb-2">
                            No Repository Connected
                        </h2>
                        <p className="text-sm text-textSub leading-relaxed">
                            Connect a GitHub repository to start monitoring your cloud infrastructure.
                            NexusOps will analyze your IaC configurations and provide governance insights.
                        </p>
                    </div>
                    <Link
                        href="/repositories"
                        className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Connect a Repository
                    </Link>
                    <p className="text-xs text-textMuted mt-2">
                        Once connected, dashboards, compliance checks, and cost analysis will appear here.
                    </p>
                </div>
            </PageContainer>
        );
    }

    // ─── Ingesting state ───
    const ingestingRepos = repos.filter(r => r.status === "INGESTING");
    if (ingestingRepos.length > 0) {
        return (
            <PageContainer
                heading="Dashboard"
                description="Setting up your workspace..."
            >
                <div className="flex flex-col items-center justify-center py-16 gap-8">
                    {/* Spinning loader */}
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                            <ArrowPathIcon className="h-10 w-10 text-primary animate-spin" />
                        </div>
                    </div>

                    <div className="text-center max-w-lg">
                        <h2 className="text-xl font-semibold text-textMain mb-2">
                            Ingesting Repository Context
                        </h2>
                        <p className="text-sm text-textSub leading-relaxed mb-6">
                            NexusOps is analyzing your connected repositories to build a governance context.
                            This includes scanning IaC configurations, identifying resources, and mapping policies.
                        </p>
                    </div>

                    {/* Repo being ingested */}
                    <div className="w-full max-w-md mt-4">
                        <p className="text-xs text-textMuted mb-2 uppercase tracking-wide font-medium">
                            Repositories being ingested
                        </p>
                        <div className="space-y-2">
                            {ingestingRepos.map((repo) => (
                                <div key={repo.id} className="card p-3 flex items-center gap-3">
                                    <ArrowPathIcon className="h-4 w-4 text-primary animate-spin shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-textMain">{repo.name}</p>
                                        <p className="text-xs text-textMuted">{repo.html_url}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </PageContainer>
        );
    }

    // ─── Done — repo dashboard with chat ───
    return (
        <>
            <PageContainer
                heading="Dashboard"
                description={`Monitoring ${repos.length} connected ${repos.length === 1 ? "repository" : "repositories"}.`}
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="btn-primary flex items-center gap-2 text-xs"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Export Report
                        </button>
                    </div>
                }
            >
                {/* Stats Section */}
                {!statsLoading && stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="card p-4 border border-[#2A2E35] bg-[#111318]">
                            <p className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">Total Executions</p>
                            <p className="text-3xl font-bold text-white tracking-tight">{stats.total_executions}</p>
                        </div>
                        <div className="card p-4 border border-green-900/40 bg-green-900/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-12 h-12 bg-green-900/30 rounded-bl-full"></div>
                            <p className="text-green-400 text-xs font-semibold mb-1 uppercase tracking-wider">Success Rate</p>
                            <p className="text-3xl font-bold text-green-300 tracking-tight">{stats.success_rate}%</p>
                        </div>
                        <div className="card p-4 border border-amber-900/40 bg-amber-900/10">
                            <p className="text-amber-400 text-xs font-semibold mb-1 uppercase tracking-wider">Pending Approval</p>
                            <p className="text-3xl font-bold text-amber-300 tracking-tight">{stats.pending_approvals}</p>
                        </div>
                        <div className="card p-4 border border-red-900/40 bg-red-900/10">
                            <p className="text-red-400 text-xs font-semibold mb-1 uppercase tracking-wider">Failed Flow Stops</p>
                            <p className="text-3xl font-bold text-red-300 tracking-tight">{stats.failed_executions}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-textMain">Connected Repositories</h2>
                        <Link
                            href="/repositories"
                            className="text-xs text-primary hover:text-primary/80 font-medium"
                        >
                            Manage Repositories →
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {repos.map((repo) => (
                            <div key={repo.id} className="card flex flex-col gap-3 p-4 border border-[#2A2E35]">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <GlobeAltIcon className="h-5 w-5 text-primary shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">
                                                {repo.name}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">
                                                {repo.html_url}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-green-900/40 text-green-400 border border-green-800 shrink-0 tracking-wider font-mono">
                                        <CheckCircleIcon className="h-3 w-3" />
                                        {repo.status || "Ready"}
                                    </span>
                                </div>
                                <a
                                    href={repo.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#FF9900] hover:text-[#FFB347] transition-colors mt-1 font-medium"
                                >
                                    View on GitHub ↗
                                </a>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Executions Widget */}
                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-textMain">Recent Agentic Executions</h2>
                        <Link
                            href="/executions"
                            className="text-xs text-primary hover:text-primary/80 font-medium"
                        >
                            View All Executions →
                        </Link>
                    </div>

                    {!statsLoading && recentExecutions.length > 0 ? (
                        <ExecutionList executions={recentExecutions} />
                    ) : (
                        <div className="card p-8 text-center border-dashed border-[#2A2E35] bg-[#111318]">
                            <p className="text-sm text-textMuted">
                                No executions have been run yet.
                            </p>
                            <p className="text-xs text-textMuted mt-2">
                                Use the chat assistant below to query your infrastructure and trigger your first execution.
                            </p>
                        </div>
                    )}
                </div>
            </PageContainer>

            {/* Floating Chat Button */}
            {!isChatOpen && (
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-black/50 hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-105 z-50 border border-primary/20"
                    title="Ask NexusOps"
                >
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                </button>
            )}

            {/* Chat Panel */}
            <ChatPanel
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                repos={repos}
                onExecutionStarted={refreshData}
            />
        </>
    );
}
