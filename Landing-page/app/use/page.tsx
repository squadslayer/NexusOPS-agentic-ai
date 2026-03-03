"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function AuthRedirect() {
    const router = useRouter();
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    router.push("/dashboard");
                    return 100;
                }
                return prev + 5;
            });
        }, 100);

        return () => clearInterval(timer);
    }, [router]);

    return (
        <div className="container" style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div className="glass-panel" style={{ padding: "4rem", textAlign: "center", maxWidth: "500px", width: "100%" }}>
                <ShieldAlert size={64} style={{ color: "var(--brand-primary)", margin: "0 auto 2rem" }} />
                <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Authenticating</h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: "2.5rem" }}>
                    Simulating SSO Token Exchange and Identity Provider Handshake...
                </p>

                <div style={{ background: "var(--bg-elevated)", height: "8px", borderRadius: "4px", width: "100%", overflow: "hidden", marginBottom: "1rem" }}>
                    <div
                        style={{
                            height: "100%",
                            width: `${progress}%`,
                            background: "linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))",
                            transition: "width 0.1s linear"
                        }}
                    />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--brand-primary)" }}>
                    <Loader2 size={20} className="lucide-spin" style={{ animation: "spin 2s linear infinite" }} />
                    <span>Verifying IAM Lease...</span>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}} />
            </div>
        </div>
    );
}
