import { ShieldAlert, Key, Eye, Lock } from "lucide-react";

export default function Security() {
    return (
        <div className="animate-fade-in relative z-10 w-full overflow-hidden container" style={{ padding: "6rem 2rem 8rem" }}>
            <div className="bg-gradient-glow" style={{ top: "60%", left: "50%" }}></div>

            <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", marginBottom: "4rem" }}>
                <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", marginBottom: "1rem" }}>Zero-Trust Security</h1>
                <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)" }}>
                    Agentic automation without compromising enterprise governance, identity, or observability.
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "2rem" }}>
                <div className="glass-panel" style={{ padding: "2.5rem" }}>
                    <div style={{ color: "var(--brand-primary)", marginBottom: "1.5rem" }}>
                        <Lock size={48} />
                    </div>
                    <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>IAM Least Privilege</h3>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Assumes specific IAM roles based on the authenticated user. Operations match the requesting human identity, propagating through Bedrock Knowledge Bases and lambda executors. No single "God Role" exists for the system.
                    </p>
                </div>

                <div className="glass-panel delay-100" style={{ padding: "2.5rem" }}>
                    <div style={{ color: "var(--brand-secondary)", marginBottom: "1.5rem" }}>
                        <Key size={48} />
                    </div>
                    <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>SSO Integration</h3>
                    <p style={{ color: "var(--text-secondary)" }}>
                        SAML and OIDC integrations allow seamless usage via enterprise Active Directory mapping. Tenants are isolated using strict namespace partitioning for multi-org deployments.
                    </p>
                </div>

                <div className="glass-panel delay-200" style={{ padding: "2.5rem" }}>
                    <div style={{ color: "var(--accent)", marginBottom: "1.5rem" }}>
                        <Eye size={48} />
                    </div>
                    <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Audit Logger</h3>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Tamper-evident CloudWatch and S3 storage mechanisms track every aspect of the interaction. User queries, sources retrieved, LLM reasonings, and lambda invocations strictly bound to the ID of the requester.
                    </p>
                </div>

                <div className="glass-panel delay-300" style={{ padding: "2.5rem" }}>
                    <div style={{ color: "#10b981", marginBottom: "1.5rem" }}>
                        <ShieldAlert size={48} />
                    </div>
                    <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Strict Approvals</h3>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Risk models enforce Human-in-the-Loop workflows for modifying components. SNS queues approvals to secondary admins after 10m of inactivity, explicitly canceling the pipeline post 15m.
                    </p>
                </div>
            </div>
        </div>
    );
}
