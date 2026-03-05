"use client";

import { useMemo } from "react";
import {
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    LockClosedIcon,
    GlobeAltIcon,
    PlusIcon
} from "@heroicons/react/24/outline";
import { type Repository } from "@/hooks/useRepositories";
import { formatDate } from "@/lib/utils";
import { StartExecution } from "@/components/execution/startExecution";

interface RepoCardProps {
    repo: Repository;
    onConnect: (id: string) => void;
    isConnecting?: boolean;
}

export function RepoCard({ repo, onConnect, isConnecting = false }: RepoCardProps) {
    const handleConnect = () => {
        if (!repo.connected && !isConnecting) {
            onConnect(repo.id);
        }
    };

    const StatusBadge = useMemo(() => {
        if (!repo.connected) {
            return (
                <span className="badge badge-neutral text-xs">
                    Unconnected
                </span>
            );
        }

        switch (repo.status) {
            case "READY":
                return (
                    <span className="badge badge-success text-xs gap-1">
                        <CheckCircleIcon className="h-3 w-3" />
                        Ready
                    </span>
                );
            case "INGESTING":
                return (
                    <span className="badge badge-warning text-xs gap-1">
                        <ArrowPathIcon className="h-3 w-3 animate-spin" />
                        Ingesting
                    </span>
                );
            case "ERROR":
                return (
                    <span className="badge badge-danger text-xs gap-1">
                        <XCircleIcon className="h-3 w-3" />
                        Error
                    </span>
                );
            case "CONNECTING":
                return (
                    <span className="badge badge-warning text-xs gap-1">
                        <ArrowPathIcon className="h-3 w-3 animate-spin" />
                        Connecting
                    </span>
                );
            default:
                return (
                    <span className="badge badge-neutral text-xs text-textMuted">
                        {repo.status || "Linked"}
                    </span>
                );
        }
    }, [repo.connected, repo.status]);


    return (
        <div className={`
            card flex flex-col md:flex-row md:items-center justify-between gap-4
            transition-all duration-200
            ${repo.connected ? "border-primary/20 bg-surface/50" : "hover:border-borderHover"}
        `}>
            {/* Repo Info */}
            <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {repo.private ? (
                        <LockClosedIcon className="h-4 w-4 text-textMuted flex-shrink-0" aria-label="Private repository" />
                    ) : (
                        <GlobeAltIcon className="h-4 w-4 text-textMuted flex-shrink-0" aria-label="Public repository" />
                    )}
                    <h3 className="text-sm font-semibold text-textMain truncate" title={repo.full_name}>
                        {repo.name}
                    </h3>
                    {StatusBadge}
                </div>

                <p className="text-xs text-textSub font-mono truncate" title={repo.full_name}>
                    {repo.full_name}
                </p>

                {repo.connected && (
                    <p className="text-2xs text-textMuted">
                        Connected {repo.connected_at ? formatDate(repo.connected_at) : "N/A"}
                    </p>
                )}

            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
                {!repo.connected ? (
                    <button
                        type="button"
                        onClick={handleConnect}
                        disabled={isConnecting || repo.status === "CONNECTING"}

                        className={`
                            btn btn-primary btn-sm flex items-center gap-1.5
                            ${isConnecting ? "opacity-75 cursor-not-allowed" : ""}
                        `}
                    >
                        {isConnecting ? (
                            <>
                                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <PlusIcon className="h-3.5 w-3.5" />
                                Connect
                            </>
                        )}
                    </button>
                ) : (
                    <StartExecution
                        repoUrl={repo.html_url}
                        repoName={repo.name}
                    />
                )}
            </div>
        </div>
    );
}
