import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap, Activity } from "lucide-react";

export default function Home() {
    return (
        <div className="animate-fade-in relative z-10 w-full overflow-hidden">
            <div className="bg-gradient-glow"></div>

            {/* Hero Section */}
            <section className="container" style={{ padding: "6rem 2rem 4rem", textAlign: "center" }}>
                <h1 style={{ fontSize: "clamp(3rem, 6vw, 5rem)", marginBottom: "1.5rem", letterSpacing: "-0.02em" }}>
                    The <span className="text-gradient">Agentic AI</span><br />
                    Engineering Assistant
                </h1>
                <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)", maxWidth: "800px", margin: "0 auto 3rem", textWrap: "balance" }}>
                    AWS-native, deeply integrated, and built for strict security governance.
                    NexusOps enhances your engineering velocity through a verified 5-step agentic loop.
                </p>

                <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                    <Link href="/use" className="btn btn-primary lg" style={{ fontSize: "1.1rem", padding: "1rem 2rem" }}>
                        Start Building Free
                        <ArrowRight size={20} style={{ marginLeft: "0.5rem" }} />
                    </Link>
                    <Link href="/architecture" className="btn btn-secondary lg" style={{ fontSize: "1.1rem", padding: "1rem 2rem" }}>
                        View Architecture
                    </Link>
                </div>
            </section>

            {/* Overview Section */}
            <section className="container" style={{ padding: "4rem 2rem 8rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
                    <div className="glass-panel delay-100" style={{ padding: "2.5rem" }}>
                        <div style={{ background: "rgba(59, 130, 246, 0.1)", width: "56px", height: "56px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", color: "var(--brand-primary)" }}>
                            <ShieldCheck size={32} />
                        </div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Zero-Trust Approvals</h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            No autonomous destructive actions. Every high-risk lambda invocation requires explicit human approval via the Approval Gateway.
                        </p>
                    </div>

                    <div className="glass-panel delay-200" style={{ padding: "2.5rem" }}>
                        <div style={{ background: "rgba(139, 92, 246, 0.1)", width: "56px", height: "56px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", color: "var(--brand-secondary)" }}>
                            <Activity size={32} />
                        </div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>5-Step Agentic Loop</h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Ask → Retrieve → Reason → Act → Verify. A predictable, auditable sequence replacing unbounded, expensive multi-step orchestration.
                        </p>
                    </div>

                    <div className="glass-panel delay-300" style={{ padding: "2.5rem" }}>
                        <div style={{ background: "rgba(244, 63, 94, 0.1)", width: "56px", height: "56px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", color: "var(--accent)" }}>
                            <Zap size={32} />
                        </div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Free-Tier Optimized</h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Built specifically to leverage AWS free-tiers. Eliminates unpredictable compute costs associated with continuous autonomous agent loops.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
