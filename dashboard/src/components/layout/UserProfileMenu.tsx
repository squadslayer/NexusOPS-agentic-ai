"use client";

import { useState, useRef, useEffect } from "react";
import { UserCircleIcon, ArrowRightStartOnRectangleIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useGitHubUser } from "@/hooks/useGitHubUser";
import Image from "next/image";

export function UserProfileMenu() {
    const { user, isLoading, logout } = useGitHubUser();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 pl-3 border-l border-border animate-pulse">
                <div className="h-7 w-7 rounded-full bg-surfaceHover" />
                <div className="hidden sm:flex flex-col gap-1">
                    <div className="h-2.5 w-20 rounded bg-surfaceHover" />
                    <div className="h-2 w-14 rounded bg-surfaceHover" />
                </div>
            </div>
        );
    }

    const displayName = user?.name || user?.login || "User";
    const displaySub = user?.login ? `@${user.login}` : "GitHub";

    return (
        <div ref={ref} className="relative flex items-center gap-2 pl-3 border-l border-border">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surfaceHover transition-colors"
                aria-haspopup="true"
                aria-expanded={open}
            >
                {/* Avatar */}
                {user?.avatar_url ? (
                    <Image
                        src={user.avatar_url}
                        alt={displayName}
                        width={28}
                        height={28}
                        className="rounded-full ring-1 ring-border"
                        unoptimized
                    />
                ) : (
                    <UserCircleIcon className="h-7 w-7 text-textSub" />
                )}

                {/* Name */}
                <div className="hidden sm:flex flex-col leading-none text-left">
                    <span className="text-xs font-medium text-textMain">{displayName}</span>
                    <span className="text-2xs text-textMuted">{displaySub}</span>
                </div>

                <ChevronDownIcon
                    className={`h-3.5 w-3.5 text-textMuted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-border bg-card shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User info header */}
                    <div className="px-3 py-2.5 border-b border-border">
                        <p className="text-xs font-semibold text-textMain truncate">{displayName}</p>
                        {user?.email && (
                            <p className="text-2xs text-textMuted truncate">{user.email}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <button
                        onClick={() => { setOpen(false); logout(); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-dangerText hover:bg-danger/10 transition-colors"
                    >
                        <ArrowRightStartOnRectangleIcon className="h-4 w-4 shrink-0" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
