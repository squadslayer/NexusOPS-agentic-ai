import { Navigation } from "@/components/layout/Navigation";
import { Header } from "@/components/layout/Header";
import { ExecutionOverlay } from "@/components/execution/ExecutionOverlay";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="flex h-screen w-full overflow-hidden bg-background">
                {/* Fixed-width left sidebar */}
                <Navigation />

                {/* Right side: header + scrollable page content */}
                <div className="flex flex-1 flex-col min-w-0">
                    <Header />

                    <main className="flex-1 overflow-y-auto p-6">
                        <div className="mx-auto max-w-screen-xl w-full">
                            {children}
                        </div>
                    </main>
                    <ExecutionOverlay />
                </div>
            </div>
        </AuthGuard>
    );
}
