import { redirect } from "next/navigation";

/**
 * Root page — immediately redirects to /login.
 * AuthGuard on the dashboard routes will forward to /dashboard
 * if the user is already authenticated.
 */
export default function RootPage() {
    redirect("/login");
}
