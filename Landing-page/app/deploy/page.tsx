import { Server, Terminal, Cloud, Check } from "lucide-react";

export default function Deploy() {
    return (
        <div className="animate-fade-in relative z-10 w-full overflow-hidden container" style={{ padding: "6rem 2rem 8rem" }}>
            <div className="bg-gradient-glow" style={{ top: "40%", left: "40%" }}></div>

            <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", marginBottom: "4rem" }}>
                <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", marginBottom: "1rem" }}>Deployment & Integrations</h1>
                <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)" }}>
                    Fully AWS-native, infrastructure as code, and strictly constrained MVP configurations.
                </p>
            </div>

            <div className="glass-panel" style={{ padding: "3rem", maxWidth: "900px", margin: "0 auto", marginBottom: "4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem", color: "var(--brand-primary)" }}>
                    <Cloud size={32} />
                    <h2 style={{ fontSize: "2rem", color: "white" }}>AWS-Native Architecture</h2>
                </div>

                <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: "2rem" }}>
                    NexusOps relies 100% on native AWS components mapped specifically to free-tier eligibility limits, mitigating unexpected usage spikes and maximizing long-term viability.
                </p>

                <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", listStyle: "none" }}>
                    <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <Check size={20} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                        <div>
                            <strong style={{ display: "block", color: "white", marginBottom: "0.25rem" }}>API Gateway</strong>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>1M requests/month</span>
                        </div>
                    </li>
                    <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <Check size={20} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                        <div>
                            <strong style={{ display: "block", color: "white", marginBottom: "0.25rem" }}>AWS Lambda</strong>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>1M requests + 400K GB-secs</span>
                        </div>
                    </li>
                    <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <Check size={20} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                        <div>
                            <strong style={{ display: "block", color: "white", marginBottom: "0.25rem" }}>Amazon S3</strong>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>5GB standard storage</span>
                        </div>
                    </li>
                    <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <Check size={20} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                        <div>
                            <strong style={{ display: "block", color: "white", marginBottom: "0.25rem" }}>DynamoDB</strong>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>25GB + 25 RCU/WCU</span>
                        </div>
                    </li>
                    <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <Check size={20} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                        <div>
                            <strong style={{ display: "block", color: "white", marginBottom: "0.25rem" }}>CloudWatch</strong>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>10 Custom Metrics + 5GB Logs</span>
                        </div>
                    </li>
                    <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <Check size={20} style={{ color: "var(--accent)", marginTop: "4px" }} />
                        <div>
                            <strong style={{ display: "block", color: "white", marginBottom: "0.25rem" }}>Amazon Bedrock</strong>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Pay-per-token (Strictly capped)</span>
                        </div>
                    </li>
                </ul>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", maxWidth: "900px", margin: "0 auto" }}>
                <div className="glass-panel delay-100" style={{ padding: "2.5rem" }}>
                    <Server size={32} style={{ color: "var(--brand-secondary)", marginBottom: "1rem" }} />
                    <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Enterprise Repositories</h3>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
                        Integrations explicitly allow-list metadata and text-parsing from:
                    </p>
                    <ul style={{ color: "var(--text-muted)", listStylePosition: "inside", lineHeight: "1.8" }}>
                        <li>GitHub (Read-only Code)</li>
                        <li>Confluence (Wiki)</li>
                        <li>Jira (Issue Tracking)</li>
                        <li>Slack (Communication History)</li>
                    </ul>
                </div>

                <div className="glass-panel delay-200" style={{ padding: "2.5rem" }}>
                    <Terminal size={32} style={{ color: "var(--accent)", marginBottom: "1rem" }} />
                    <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Launch Quickstart</h3>
                    <div style={{ background: "rgba(0,0,0,0.5)", padding: "1rem", borderRadius: "8px", fontFamily: "monospace", color: "#a78bfa", fontSize: "0.9rem" }}>
                        <p>$ git clone nexusops-aws</p>
                        <p>$ npm install</p>
                        <p>$ npx cdk deploy --all</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
