"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGitHubUser } from "@/hooks/useGitHubUser";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

/**
 * TokenHandler — small sub-component to safely use useSearchParams.
 * This needs to be wrapped in <Suspense> during SSR/Static Generation.
 */
/**
 * AuthGuard — wraps any page that requires authentication.
 * - Picks up ?token= from GitHub OAuth redirect and saves it to localStorage.
 * - If no valid token found, redirects to /login.
 */
function AuthGuardContent({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useGitHubUser();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // 1. First check if a new token just arrived in the URL
        const token = searchParams.get("token");
        if (token) {
            console.log("[AuthGuard] New token detected in URL, saving to nexusops_token...");
            localStorage.setItem("nexusops_token", token);

            // Clean the URL without a full page reload if possible
            const url = new URL(window.location.href);
            url.searchParams.delete("token");

            // We use router.replace to the clean dashboard URL
            // This will re-trigger the AuthGuard useEffect but without the token
            router.replace("/dashboard");
            return;
        }

        // 2. Only redirect to login if we are fully loaded and not authenticated
        // AND there is no token in the process of being saved above
        if (!isLoading && !isAuthenticated && !token) {
            router.replace("/login");
        }
    }, [isLoading, isAuthenticated, router, searchParams]);

    // While checking auth — show a centered loading spinner
    if (isLoading || searchParams.has("token")) {
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

export function AuthGuard({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={null}>
            <AuthGuardContent>{children}</AuthGuardContent>
        </Suspense>
    );
}
