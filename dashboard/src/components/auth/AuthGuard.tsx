"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGitHubUser } from "@/hooks/useGitHubUser";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

/**
 * AuthGuard — wraps any page that requires authentication.
 * - Picks up ?token= from GitHub OAuth redirect and saves it to localStorage.
 * - If no valid token found, redirects to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useGitHubUser();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Pick up GitHub OAuth redirect token (?token=<jwt>)
    useEffect(() => {
        const token = searchParams.get("token");
        if (token) {
            localStorage.setItem("token", token);
            // Clean the token from the URL without a page reload
            const url = new URL(window.location.href);
            url.searchParams.delete("token");
            window.history.replaceState({}, "", url.toString());
            // Reload to re-trigger useGitHubUser with the new token
            window.location.reload();
        }
    }, [searchParams]);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace("/login");
        }
    }, [isLoading, isAuthenticated, router]);

    // While checking auth — show a centered loading spinner
    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 z-50">
                <ShieldCheckIcon className="h-10 w-10 text-primary animate-pulse" />
                <p className="text-sm text-textMuted font-medium tracking-wide">Verifying session…</p>
            </div>
        );
    }

    // Not authenticated — render nothing (redirect is in progress)
    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
