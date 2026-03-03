import { Database, CloudFog, Cpu, Network, ShieldCheck } from "lucide-react";

export default function Architecture() {
    return (
        <div className="animate-fade-in relative z-10 w-full overflow-hidden container" style={{ padding: "6rem 2rem 8rem" }}>
            <div className="bg-gradient-glow" style={{ top: "30%", left: "70%" }}></div>

            <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
                <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", marginBottom: "1rem" }}>System Architecture</h1>
                <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)", marginBottom: "4rem" }}>
                    A purely AWS-native serverless approach ensuring peak performance, zero downtime, and absolute strict data governance.
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
                <div className="glass-panel" style={{ padding: "3rem", display: "flex", gap: "2rem", alignItems: "center" }}>
                    <div style={{ minWidth: "80px", color: "var(--brand-primary)" }}>
                        <CloudFog size={64} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>API Gateway Layer</h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Secure HTTP endpoint for user interactions utilizing enterprise authentication mappings and request throttling. Fully integrates with AWS IAM Identity Center for SSO.
                        </p>
                    </div>
                </div>

                <div className="glass-panel delay-100" style={{ padding: "3rem", display: "flex", gap: "2rem", alignItems: "center" }}>
                    <div style={{ minWidth: "80px", color: "var(--brand-secondary)" }}>
                        <Cpu size={64} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Lambda Orchestrator</h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Replaces unconstrained multi-step agents. This deterministic orchestrator manages the 5-step loop State Machine via DynamoDB, strictly capping execution time and reasoning bounds.
                        </p>
                    </div>
                </div>

                <div className="glass-panel delay-200" style={{ padding: "3rem", display: "flex", gap: "2rem", alignItems: "center" }}>
                    <div style={{ minWidth: "80px", color: "var(--accent)" }}>
                        <Database size={64} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Knowledge Retrieval</h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Amazon Bedrock Knowledge Bases and vector similarity search. Returns 100% cited information from curated enterprise sources (GitHub, Confluence, S3) with fallbacks.
                        </p>
                    </div>
                </div>

                <div className="glass-panel delay-300" style={{ padding: "3rem", display: "flex", gap: "2rem", alignItems: "center" }}>
                    <div style={{ minWidth: "80px", color: "#10b981" }}>
                        <ShieldCheck size={64} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Action Registry & Approval Gateway</h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Actions are mapped strictly to allowlisted Lambda functions. High risk mutations hit an SQS/SNS queue requiring 15-minute manual approver timeouts before proceeding.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
