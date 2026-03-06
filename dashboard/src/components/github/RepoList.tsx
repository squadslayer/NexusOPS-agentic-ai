"use client";

import { useState, useEffect } from "react";
import { RepoCard } from "@/components/github/RepoCard";
import { useRepositories } from "@/hooks/useRepositories";
import {
    ShieldCheckIcon,
    CloudArrowDownIcon,
    MagnifyingGlassIcon,
    CheckCircleIcon,
    GlobeAltIcon
} from "@heroicons/react/24/outline";

export function RepoList() {
    const { repositories, availableRepos, isLoading, error, connectRepo, fetchAvailable } = useRepositories();
    const [connectingRepoId, setConnectingRepoId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchAvailable();
    }, [fetchAvailable]);

    const handleConnect = async (repo: any) => {
        setConnectingRepoId(repo.id);
        try {
            await connectRepo(repo.html_url, ""); // code is optional now
        } catch (err) {
            console.error("Failed to connect repo:", err);
        } finally {
            setConnectingRepoId(null);
        }
    };

    const filteredAvailable = availableRepos.filter(repo =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredConnected = repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.full_name && repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (isLoading && repositories.length === 0 && availableRepos.length === 0) {
        return (
            <div className="card flex flex-col items-center justify-center p-12 text-center h-64 animate-pulse">
                <CloudArrowDownIcon className="h-10 w-10 text-textMuted mb-4" />
                <h3 className="text-sm font-semibold text-textMain">Loading repositories...</h3>
                <p className="text-xs text-textSub mt-1">Contacting configuration BFF...</p>
            </div>
        );
    }

    if (error && repositories.length === 0) {
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
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-textMain tracking-tight">GitHub Repositories</h2>
                    <p className="text-sm text-textSub mt-1">
                        Manage your connected repositories and discover new ones to ingest.
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

            {/* Connected Repositories Section */}
            {filteredConnected.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-primary" />
                        <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider">Connected Repositories</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {filteredConnected.map(repo => (
                            <RepoCard
                                key={repo.id}
                                repo={{ ...repo, connected: true }}
                                onConnect={() => { }}
                                isConnecting={false}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Available Repositories Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <GlobeAltIcon className="h-5 w-5 text-textMuted" />
                    <h3 className="text-sm font-semibold text-textMain uppercase tracking-wider">Available to Connect</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {filteredAvailable.length > 0 ? (
                        filteredAvailable.map(repo => {
                            const isConnected = repositories.some(r => r.html_url === repo.html_url);
                            if (isConnected) return null; // Don't show already connected ones in available list
                            return (
                                <RepoCard
                                    key={repo.id}
                                    repo={repo}
                                    onConnect={() => handleConnect(repo)}
                                    isConnecting={connectingRepoId === repo.id}
                                />
                            );
                        })
                    ) : (
                        <div className="card p-8 text-center text-textMuted text-sm border-dashed">
                            {searchQuery ? "No repositories match your filter." : "No additional repositories found for this GitHub account."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RepoList;
