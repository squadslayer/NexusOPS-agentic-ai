"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export type Repository = {
    id: string;
    name: string;
    full_name: string;
    html_url: string;
    private: boolean;
    connected?: boolean;
    ingestionStatus?: "IDLE" | "PENDING" | "COMPLETED" | "FAILED";
    updatedAt?: string;
};

type UseRepositoriesReturn = {
    repositories: Repository[];
    isLoading: boolean;
    error: string | null;
    connectRepo: (repoId: string) => Promise<void>;
    refresh: () => Promise<void>;
};

// Helper to get/set connected repos from localStorage
function getConnectedRepoIds(): string[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem("nexusops_connected_repos") || "[]");
    } catch {
        return [];
    }
}

function saveConnectedRepoIds(ids: string[]) {
    if (typeof window !== "undefined") {
        localStorage.setItem("nexusops_connected_repos", JSON.stringify(ids));
    }
}

export function useRepositories(): UseRepositoriesReturn {
    const [repositories, setRepositories] = useState<Repository[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRepos = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/repos/");
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to fetch repositories");
            }

            const fetched: Repository[] = data.data?.repositories || [];
            const connectedIds = getConnectedRepoIds();

            // Mark repos as connected if they are in localStorage
            const enriched = fetched.map((r) => ({
                ...r,
                id: String(r.id),
                connected: connectedIds.includes(String(r.id)),
                ingestionStatus: connectedIds.includes(String(r.id))
                    ? ("COMPLETED" as const)
                    : ("IDLE" as const),
            }));

            setRepositories(enriched);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRepos();
    }, [fetchRepos]);

    const connectRepo = useCallback(
        async (repoId: string) => {
            // Save the repo as "connected" in localStorage (simulates ingestion)
            const connectedIds = getConnectedRepoIds();
            if (!connectedIds.includes(repoId)) {
                connectedIds.push(repoId);
                saveConnectedRepoIds(connectedIds);
            }

            // Update local state immediately
            setRepositories((prev) =>
                prev.map((r) =>
                    String(r.id) === repoId
                        ? { ...r, connected: true, ingestionStatus: "COMPLETED" as const }
                        : r
                )
            );
        },
        []
    );

    return {
        repositories,
        isLoading,
        error,
        connectRepo,
        refresh: fetchRepos,
    };
}
