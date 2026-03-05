"use client";

import { useState } from "react";
import { RepoCard } from "@/components/github/RepoCard";
import { useRepositories } from "@/hooks/useRepositories";
import { ShieldCheckIcon, CloudArrowDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export function RepoList() {
    const { repositories, isLoading, error, connectRepo } = useRepositories();
    const [connectingRepoId, setConnectingRepoId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const handleConnect = async (id: string) => {
        setConnectingRepoId(id);
        try {
            await connectRepo(id);
        } finally {
            setConnectingRepoId(null);
        }
    };

    const filteredRepos = repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="card flex flex-col items-center justify-center p-12 text-center h-64 animate-pulse">
                <CloudArrowDownIcon className="h-10 w-10 text-textMuted mb-4" />
                <h3 className="text-sm font-semibold text-textMain">Loading repositories...</h3>
                <p className="text-xs text-textSub mt-1">Contacting configuration BFF...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card flex flex-col items-start p-6 border-danger/40 bg-danger/5 gap-3">
                <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5 text-dangerText" />
                    <h3 className="text-sm font-semibold text-dangerText">Repository Sync Failed</h3>
                </div>
                <p className="text-sm text-dangerText/80">
                    {error}
                </p>
                <p className="text-xs text-textMuted pt-2">
                    Please ensure your GitHub app installation is valid and the BFF service is reachable.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-textMain tracking-tight">Available Repositories</h2>
                    <p className="text-sm text-textSub mt-0.5">
                        Select repositories to ingest into NexusOPS for anomaly analysis.
                    </p>
                </div>

                <div className="relative w-full sm:w-64">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted" />
                    <input
                        type="text"
                        placeholder="Filter by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="
                            w-full pl-9 pr-3 py-1.5 text-sm rounded border border-border
                            bg-background text-textMain placeholder:text-textMuted
                            focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                        "
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {filteredRepos.length > 0 ? (
                    filteredRepos.map(repo => (
                        <RepoCard
                            key={repo.id}
                            repo={repo}
                            onConnect={handleConnect}
                            isConnecting={connectingRepoId === repo.id}
                        />
                    ))
                ) : (
                    <div className="card p-8 text-center text-textMuted text-sm border-dashed">
                        {searchQuery ? "No repositories match your filter." : "No repositories found for this GitHub account."}
                    </div>
                )}
            </div>
        </div>
    );
}

// Ensure the default export exists for layout/page consumption
export default RepoList;
