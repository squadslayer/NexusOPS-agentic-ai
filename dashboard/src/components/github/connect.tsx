"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PlusIcon } from "@heroicons/react/24/outline";

export function GitHubConnect() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/repos/authorize");
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to initiate GitHub connection");
            }

            if (data.data?.oauth_url) {
                window.location.href = data.data.oauth_url;
            } else {
                throw new Error("OAuth URL not received from BFF");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleConnect}
                disabled={isLoading}
                className="btn-primary flex items-center gap-2 text-sm"
            >
                <PlusIcon className="h-4 w-4" />
                {isLoading ? "Connecting..." : "Connect GitHub Repository"}
            </button>
            {error && <p className="text-xs text-dangerText">{error}</p>}
        </div>
    );
}
