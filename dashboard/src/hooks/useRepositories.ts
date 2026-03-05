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
    connectRepo: (repoUrl: string) => Promise<void>;
    refresh: () => Promise<void>;
};

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
                throw new Error(data.error || "Failed to fetch repositories");
            }

            setRepositories(data.data?.repositories || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRepos();
    }, [fetchRepos]);

    const connectRepo = useCallback(async (repoUrl: string) => {
        setIsLoading(true);
        setError(null);
        try {
            // Initiate connection (this redirects to GitHub usually)
            // But if we have a direct connect endpoint, we use it.
            const res = await apiFetch("/repos/connect", {
                method: "POST",
                body: JSON.stringify({ repo_url: repoUrl })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to connect repository");

            await fetchRepos();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect repository");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [fetchRepos]);

    return {
        repositories,
        isLoading,
        error,
        connectRepo,
        refresh: fetchRepos,
    };
}
