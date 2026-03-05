"use client";

import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * LoginPage — GitHub OAuth sign-in.
 * Clicking the button redirects to BFF /auth/github which
 * starts the OAuth flow. On return the BFF redirects to
 * /dashboard?token=<jwt> which is picked up by the dashboard layout.
 */
function GitHubIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.165c-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.605-2.665-.3-5.467-1.332-5.467-5.93 0-1.31.468-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.625-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .322.218.694.825.576C20.565 21.795 24 17.298 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // If BFF redirects back with ?token=..., save it and go to dashboard
    useEffect(() => {
        const token = searchParams.get("token");
        const error = searchParams.get("error");
        if (token) {
            localStorage.setItem("token", token);
            router.replace("/dashboard");
        }
        if (error) {
            console.error("GitHub OAuth error:", error);
        }
    }, [searchParams, router]);

    const handleGitHubLogin = () => {
        window.location.href = "http://localhost:8000/auth/github";
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-6">

                {/* Brand */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <ShieldCheckIcon className="h-9 w-9 text-primary" aria-hidden />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-textMain">
                        Nexus<span className="text-primary">OPS</span>
                    </h1>
                    <p className="text-xs text-textMuted">
                        Sign in with GitHub to access the governance dashboard
                    </p>
                </div>

                {/* Card */}
                <div className="card space-y-4">

                    {/* OAuth error message */}
                    {searchParams.get("error") && (
                        <div className="flex items-center gap-2 rounded border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-dangerText">
                            <span>GitHub sign-in failed. Please try again.</span>
                        </div>
                    )}

                    {/* GitHub Sign In Button */}
                    <button
                        onClick={handleGitHubLogin}
                        className="
                            w-full flex items-center justify-center gap-3
                            rounded py-3 text-sm font-semibold
                            bg-[#24292e] hover:bg-[#2f363d] text-white
                            border border-[#444d56]
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                            active:scale-[0.98] transition-all duration-150
                        "
                    >
                        <GitHubIcon />
                        Continue with GitHub
                    </button>

                    <p className="text-center text-2xs text-textMuted">
                        Access restricted to authorised personnel only.
                    </p>
                </div>
            </div>
        </div>
    );
}
