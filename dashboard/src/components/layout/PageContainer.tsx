import { type ReactNode } from "react";
import { clsx } from "clsx";

interface PageContainerProps {
    /** Page heading — rendered as the visual H1 inside the content area */
    heading?: string;
    /** Optional sub-description below the heading */
    description?: string;
    /** Optional header-right slot for page-level actions (buttons, etc.) */
    actions?: ReactNode;
    /** Page body content */
    children: ReactNode;
    /** Additional wrapper classes */
    className?: string;
}

/**
 * PageContainer — a consistent wrapper for all route page bodies.
 * Provides heading, description, optional actions slot, and a content area.
 * Business logic stays in the parent page.tsx; this is purely presentational.
 */
export function PageContainer({
    heading,
    description,
    actions,
    children,
    className,
}: PageContainerProps) {
    return (
        <div className={clsx("space-y-6", className)}>
            {/* Page header row */}
            {(heading || actions) && (
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 min-w-0">
                        {heading && (
                            <h2 className="text-xl font-semibold text-textMain leading-tight">
                                {heading}
                            </h2>
                        )}
                        {description && (
                            <p className="text-sm text-textSub max-w-2xl">{description}</p>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2 shrink-0">{actions}</div>
                    )}
                </div>
            )}

            {/* Divider */}
            {heading && <hr className="border-divider" />}

            {/* Content */}
            <div>{children}</div>
        </div>
    );
}
