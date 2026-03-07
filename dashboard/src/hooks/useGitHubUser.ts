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
        const token = typeof window !== "undefined" ? localStorage.getItem("nexusops_token") : null;
        if (!token) {
            setIsLoading(false);
            return;
        }
        try {
            console.log("[useGitHubUser] Checking session with nexusops_token...");
            const res = await apiFetch("/auth/me");
            if (res.ok) {
                const json = await res.json();
                const data = json.data ?? json;
                console.log("[useGitHubUser] Auth check success:", data.login);
                setUser(data);
            } else {
                console.error("[useGitHubUser] Auth check failed with status:", res.status);
                // Token invalid / expired
                localStorage.removeItem("nexusops_token");
                setUser(null);
            }
        } catch (err) {
            console.error("[useGitHubUser] CRITICAL fetch error:", err);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const logout = useCallback(() => {
        localStorage.removeItem("nexusops_token");
        setUser(null);
        // Redirect to landing page after logout
        const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3001";
        window.location.href = landingUrl;
    }, []);

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
    };
}
