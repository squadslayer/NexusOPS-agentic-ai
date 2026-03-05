"use client";

import { useState } from "react";
import { useCreateExecution } from "@/hooks/useExecution";
import { PlayIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

interface StartExecutionProps {
    repoUrl: string;
    repoName: string;
}

export function StartExecution({ repoUrl, repoName }: StartExecutionProps) {
    const { execute, isLoading, error } = useCreateExecution();
    const router = useRouter();

    const handleStart = async () => {
        try {
            const execution = await execute({
                repository_url: repoUrl,
                title: `Analysis: ${repoName}`,
                type: "ANOMALY_DETECTION"
            });

            if (execution && execution.id) {
                // Navigate to the execution details page
                // Assuming the route exists based on AwsHack structure
                router.push(`/dashboard?executionId=${execution.id}`);
            }
        } catch (err) {
            console.error("Failed to start execution:", err);
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={handleStart}
                disabled={isLoading}
                className="btn-primary flex items-center justify-center gap-2 text-xs py-1.5 px-3"
            >
                {isLoading ? (
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <PlayIcon className="h-3.5 w-3.5" />
                )}
                {isLoading ? "Starting..." : "Start Analysis"}
            </button>
            {error && <p className="text-2xs text-dangerText mt-1 max-w-[150px]">{error}</p>}
        </div>
    );
}
