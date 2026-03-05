"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { apiFetch } from "@/lib/api";
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

type Repo = {
    id: string;
    name: string;
    full_name: string;
    html_url: string;
    private: boolean;
};

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
};

// ─── Chat Panel Component ─────────────────────────────────────────────────────

function ChatPanel({ isOpen, onClose, repos }: { isOpen: boolean; onClose: () => void; repos: Repo[] }) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `Welcome to NexusOPS! You have ${repos.length} ${repos.length === 1 ? "repository" : "repositories"} linked. Ask me about your cloud governance, compliance, or repository analysis.`,
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
        if (!input.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        // Simulate assistant response (in production, this would call the orchestrator)
        setTimeout(() => {
            const repoNames = repos.map((r) => r.full_name).join(", ");
            const responses: Record<string, string> = {
                default: `I'm processing your query across ${repos.length} connected repositories (${repoNames}). In production, this would trigger the NexusOPS orchestrator's Ask → Retrieve → Reason → Act → Verify loop.\n\nFor now, the ingestion pipeline is being set up. Once complete, I'll be able to analyze your IaC configurations, detect policy violations, and suggest remediations.`,
            };

            const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: responses.default,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setIsTyping(false);
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-96 max-h-[32rem] bg-surface border border-border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/90">
                <div className="flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold text-textMain">NexusOPS Assistant</span>
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
    const [repos, setRepos] = useState<Repo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ingestionPhase, setIngestionPhase] = useState<"idle" | "ingesting" | "done">("idle");
    const [isChatOpen, setIsChatOpen] = useState(false);

    useEffect(() => {
        async function fetchRepos() {
            try {
                const res = await apiFetch("/repos/");
                if (res.ok) {
                    const json = await res.json();
                    const fetched = json.data?.repositories || [];
                    setRepos(fetched);

                    // Check if we have connected repos in localStorage
                    const connectedIds = JSON.parse(
                        localStorage.getItem("nexusops_connected_repos") || "[]"
                    );
                    const connectedRepos = fetched.filter((r: Repo) =>
                        connectedIds.includes(String(r.id))
                    );

                    if (connectedRepos.length > 0) {
                        // Simulate ingestion if first time
                        const ingestionDone = localStorage.getItem("nexusops_ingestion_done");
                        if (ingestionDone) {
                            setIngestionPhase("done");
                        } else {
                            setIngestionPhase("ingesting");
                            // Simulate ingestion taking 4 seconds
                            setTimeout(() => {
                                setIngestionPhase("done");
                                localStorage.setItem("nexusops_ingestion_done", "true");
                            }, 4000);
                        }
                        setRepos(connectedRepos);
                    }
                }
            } catch {
                // silently fail — empty state will show
            } finally {
                setIsLoading(false);
            }
        }
        fetchRepos();
    }, []);

    const handleExport = () => {
        if (repos.length === 0) {
            alert("No repositories connected to export.");
            return;
        }
        const lines = [
            "NexusOPS — Repository Report",
            `Generated: ${new Date().toISOString()}`,
            `Total Repositories: ${repos.length}`,
            "",
            "Connected Repositories:",
            ...repos.map(
                (r, i) =>
                    `  ${i + 1}. ${r.full_name} (${r.private ? "Private" : "Public"}) — ${r.html_url}`
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
    if (repos.length === 0 || ingestionPhase === "idle") {
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
                            NexusOPS will analyze your IaC configurations and provide governance insights.
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
    if (ingestionPhase === "ingesting") {
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
                            NexusOPS is analyzing your connected repositories to build a governance context.
                            This includes scanning IaC configurations, identifying resources, and mapping policies.
                        </p>
                    </div>

                    {/* Progress steps */}
                    <div className="w-full max-w-md space-y-3">
                        {[
                            { label: "Connecting to GitHub API", done: true },
                            { label: "Scanning repository structure", done: true },
                            { label: "Analyzing IaC configurations", done: false, active: true },
                            { label: "Building governance context", done: false },
                            { label: "Ready for queries", done: false },
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-3">
                                {step.done ? (
                                    <CheckCircleIcon className="h-5 w-5 text-successText shrink-0" />
                                ) : step.active ? (
                                    <ArrowPathIcon className="h-5 w-5 text-primary animate-spin shrink-0" />
                                ) : (
                                    <div className="h-5 w-5 rounded-full border-2 border-border shrink-0" />
                                )}
                                <span
                                    className={`text-sm ${step.done
                                            ? "text-textMain"
                                            : step.active
                                                ? "text-primary font-medium"
                                                : "text-textMuted"
                                        }`}
                                >
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Repo being ingested */}
                    <div className="w-full max-w-md mt-4">
                        <p className="text-xs text-textMuted mb-2 uppercase tracking-wide font-medium">
                            Repositories being ingested
                        </p>
                        <div className="space-y-2">
                            {repos.map((repo) => (
                                <div key={repo.id} className="card p-3 flex items-center gap-3">
                                    <ArrowPathIcon className="h-4 w-4 text-primary animate-spin shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-textMain">{repo.name}</p>
                                        <p className="text-xs text-textMuted">{repo.full_name}</p>
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
                {/* Connected Repos */}
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
                            <div key={repo.id} className="card flex flex-col gap-3 p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {repo.private ? (
                                            <LockClosedIcon className="h-5 w-5 text-primary shrink-0" />
                                        ) : (
                                            <GlobeAltIcon className="h-5 w-5 text-primary shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-textMain truncate">
                                                {repo.name}
                                            </p>
                                            <p className="text-xs text-textMuted truncate">
                                                {repo.full_name}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-successText shrink-0">
                                        <CheckCircleIcon className="h-3 w-3" />
                                        Ingested
                                    </span>
                                </div>
                                <a
                                    href={repo.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    View on GitHub ↗
                                </a>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Placeholder for governance data */}
                <div className="mt-8 card p-8 text-center border-dashed">
                    <p className="text-sm text-textMuted">
                        Compliance checks, cost analysis, and resource trends will populate here as the orchestrator completes its analysis.
                    </p>
                    <p className="text-xs text-textMuted mt-2">
                        Use the chat assistant below to query your infrastructure.
                    </p>
                </div>
            </PageContainer>

            {/* Floating Chat Button */}
            {!isChatOpen && (
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-105 z-50"
                    title="Ask NexusOPS"
                >
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                </button>
            )}

            {/* Chat Panel */}
            <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} repos={repos} />
        </>
    );
}
