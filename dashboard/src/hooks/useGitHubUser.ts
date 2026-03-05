"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export type GitHubUser = {
    user_id: string;
    login: string;
    name: string | null;
    email?: string | null;
    avatar_url: string | null;
    html_url?: string;
};

type UseGitHubUserReturn = {
    user: GitHubUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    logout: () => void;
};

export function useGitHubUser(): UseGitHubUserReturn {
    const [user, setUser] = useState<GitHubUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUser = useCallback(async () => {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
            setIsLoading(false);
            return;
        }
        try {
            const res = await apiFetch("/auth/me");
            if (res.ok) {
                const json = await res.json();
                const data = json.data ?? json;
                setUser(data);
            } else {
                // Token invalid / expired
                localStorage.removeItem("token");
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const logout = useCallback(() => {
        localStorage.removeItem("token");
        setUser(null);
        // Redirect to landing page after logout
        window.location.href = "http://localhost:4000";
    }, []);

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
    };
}
