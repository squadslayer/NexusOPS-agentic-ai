"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";



export type Repository = {
    id: string;
    name: string;
    full_name: string;
    html_url: string;
    private?: boolean;
    connected?: boolean;
    status?: "CONNECTING" | "READY" | "INGESTING" | "ERROR";
    connected_at?: string;
};

type UseRepositoriesReturn = {
    repositories: Repository[];
    availableRepos: Repository[];
    isLoading: boolean;
    error: string | null;
    connectRepo: (repoUrl: string, code: string) => Promise<void>;
    fetchAvailable: () => Promise<void>;
    fetchConnected: () => Promise<void>;
    refresh: () => Promise<void>;
};

export function useRepositories(): UseRepositoriesReturn {
    const [repositories, setRepositories] = useState<Repository[]>([]);
    const [availableRepos, setAvailableRepos] = useState<Repository[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // 1. Fetch repos already connected to NexusOPS (from DynamoDB)
    const fetchConnected = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/repos/");
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to fetch connected repositories");
            }

            setRepositories(data.data?.repositories || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 2. Fetch all repos user has access to on GitHub (for connection flow)
    const fetchAvailable = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/repos/available");
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to fetch available repositories");
            }

            setAvailableRepos(data.data?.repositories || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConnected();
    }, [fetchConnected]);

    const connectRepo = useCallback(
        async (repoUrl: string, code: string) => {
            setIsLoading(true);
            try {
                const res = await apiFetch("/repos/connect", {
                    method: "POST",
                    body: JSON.stringify({ repo_url: repoUrl, code }),
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || "Failed to connect repository");
                }

                // Refresh connected repos list
                await fetchConnected();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Connection failed");
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [fetchConnected]
    );

    return {
        repositories,
        availableRepos,
        isLoading,
        error,
        connectRepo,
        fetchAvailable,
        fetchConnected,
        refresh: fetchConnected,
    };
}
