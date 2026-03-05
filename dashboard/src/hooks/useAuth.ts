"use client";

/**
 * useAuth.ts — Authentication hook for the Login page.
 *
 * Responsibilities (all logic lives here, nothing in the component):
 *  - Controlled form state
 *  - Client-side field validation
 *  - API call via api.ts
 *  - Redirect to /dashboard on success
 *  - Server-error surface for the UI
 *
 * The component receives only typed callbacks and state — no logic.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    loginUser,
    type LoginCredentials,
    type AuthApiError as AuthApiErrorType,
} from "@/lib/api";

// ─── Validation ───────────────────────────────────────────────────────────────

/** Maps each credential field to an optional validation message. */
export type FieldErrors = Partial<Record<keyof LoginCredentials, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(credentials: LoginCredentials): FieldErrors {
    const errors: FieldErrors = {};

    if (!credentials.email.trim()) {
        errors.email = "Email is required.";
    } else if (!EMAIL_RE.test(credentials.email)) {
        errors.email = "Enter a valid email address.";
    }

    if (!credentials.password) {
        errors.password = "Password is required.";
    } else if (credentials.password.length < 8) {
        errors.password = "Password must be at least 8 characters.";
    }

    return errors;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Everything the LoginPage component needs — no business logic required there. */
export type UseAuthReturn = {
    /** Controlled form values */
    credentials: LoginCredentials;
    /** Per-field validation errors (cleared on change) */
    fieldErrors: FieldErrors;
    /** Server error message displayed in the error banner; null when clean */
    serverError: string | null;
    /** True while the API request is in-flight */
    isLoading: boolean;
    /** Returns an onChange handler for the given field */
    handleChange: (
        field: keyof LoginCredentials
    ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Form onSubmit handler — validates then calls the API */
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
    /** Clears the server error banner (e.g. on banner dismiss) */
    clearServerError: () => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Custom hook encapsulating all authentication logic for the login form.
 * On successful login the server sets an HttpOnly cookie; the hook redirects
 * to /dashboard without storing any token client-side.
 */
export function useAuth(): UseAuthReturn {
    const router = useRouter();

    const [credentials, setCredentials] = useState<LoginCredentials>({
        email: "",
        password: "",
    });
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [serverError, setServerError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    /** Returns an onChange handler that updates `field` and clears its error. */
    const handleChange = useCallback(
        (field: keyof LoginCredentials) =>
            (e: React.ChangeEvent<HTMLInputElement>): void => {
                const value = e.target.value;
                setCredentials((prev) => ({ ...prev, [field]: value }));
                // Eagerly clear the field error so feedback isn't lagged
                setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
                setServerError(null);
            },
        []
    );

    const clearServerError = useCallback((): void => {
        setServerError(null);
    }, []);

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
            e.preventDefault();

            // 1. Client-side validation
            const errors = validate(credentials);
            if (Object.keys(errors).length > 0) {
                setFieldErrors(errors);
                return;
            }

            // 2. Call API
            setIsLoading(true);
            setServerError(null);

            try {
                await loginUser(credentials);
                // 3. Redirect — server already set the HttpOnly cookie
                router.push("/dashboard");
            } catch (err) {
                const apiErr = err as AuthApiErrorType;
                const message =
                    apiErr?.message && apiErr.message !== "[object Object]"
                        ? apiErr.message
                        : "Login failed. Please check your credentials and try again.";
                setServerError(message);
            } finally {
                setIsLoading(false);
            }
        },
        [credentials, router]
    );

    return {
        credentials,
        fieldErrors,
        serverError,
        isLoading,
        handleChange,
        handleSubmit,
        clearServerError,
    };
}
