'use client';

import { usePathname } from "next/navigation";
import { BellIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";

const ROUTE_LABELS: Record<string, string> = {
    "/": "Home",
    "/dashboard": "Dashboard",
    "/problem": "Problem Statement",
    "/aws": "AWS Resources",
    "/vision": "Vision",
    "/use": "Use Cases",
    "/resources": "Resource Inventory",
    "/compliance": "Policy Violations",
    "/costs": "Cost Anomalies",
};

function Breadcrumbs({ pathname }: { pathname: string }) {
    const segments = pathname.split("/").filter(Boolean);

    return (
        <nav className="flex items-center gap-1 text-sm text-textMuted" aria-label="Breadcrumb">
            <span className="hover:text-textMain cursor-pointer">NexusOPS</span>
            {segments.map((seg, i) => {
                const href = "/" + segments.slice(0, i + 1).join("/");
                const isLast = i === segments.length - 1;
                const label = ROUTE_LABELS[href] ?? seg.charAt(0).toUpperCase() + seg.slice(1);

                return (
                    <span key={href} className="flex items-center gap-1">
                        <ChevronRightIcon className="h-3 w-3 text-textMuted" aria-hidden />
                        <span className={isLast ? "text-textMain font-medium" : "hover:text-textMain cursor-pointer"}>
                            {label}
                        </span>
                    </span>
                );
            })}
        </nav>
    );
}

export function Header() {
    const pathname = usePathname();
    const pageTitle = ROUTE_LABELS[pathname] ?? "NexusOPS";

    return (
        <header
            className="
        h-14 shrink-0 flex items-center justify-between
        px-6 border-b border-border bg-surface
      "
        >
            {/* Left: breadcrumb */}
            <div className="flex flex-col justify-center gap-0.5 min-w-0">
                <Breadcrumbs pathname={pathname} />
                <h1 className="text-base font-semibold text-textMain leading-none">{pageTitle}</h1>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Notification bell */}
                <button
                    type="button"
                    aria-label="Notifications"
                    className="relative p-1.5 rounded text-textMuted hover:text-textMain hover:bg-surfaceHover transition-colors"
                >
                    <BellIcon className="h-5 w-5" aria-hidden />
                    {/* Badge */}
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                </button>

                {/* User profile menu — real GitHub name/avatar + logout */}
                <UserProfileMenu />
            </div>
        </header>
    );
}
