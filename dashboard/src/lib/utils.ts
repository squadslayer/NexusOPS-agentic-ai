import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely (handles class conflicts).
 * Usage: cn("px-2 py-1", isActive && "bg-primary")
 */
export function cn(...inputs: (string | undefined | null | boolean)[]): string {
    return twMerge(clsx(inputs));
}

/**
 * Format large numbers with commas (e.g. 12000 → "12,000")
 */
export function formatNumber(value: number): string {
    return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Format a Date or ISO string into a readable timestamp.
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + "...";
}
