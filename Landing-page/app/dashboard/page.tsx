import { ShieldCheck, User, Activity } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
    return (
        <div className="animate-fade-in relative z-10 w-full overflow-hidden container" style={{ padding: "6rem 2rem 8rem" }}>
            <div className="bg-gradient-glow" style={{ top: "30%", left: "50%" }}></div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4rem" }}>
                <div>
                    <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>NexusOps Dashboard</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Secure Agentic Automation Control Plane</p>
                </div>
                <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1.5rem" }}>
                    <User size={20} style={{ color: "var(--brand-primary)" }} />
                    <span>admin@nexusops.local</span>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", marginLeft: "0.5rem" }} />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem" }}>
                <div className="glass-panel" style={{ padding: "2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
                        <Activity size={24} style={{ color: "var(--brand-secondary)" }} />
                        <h2 style={{ fontSize: "1.5rem" }}>Recent Agentic Executions</h2>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>
                                <th style={{ padding: "1rem 0" }}>Operation</th>
                                <th style={{ padding: "1rem 0" }}>Status</th>
                                <th style={{ padding: "1rem 0" }}>Token Cost</th>
                                <th style={{ padding: "1rem 0" }}>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: "1rem 0" }}>Validate IAM Policy Syntax</td>
                                <td style={{ padding: "1rem 0" }}><span style={{ color: "#10b981" }}>Success (Verified)</span></td>
                                <td style={{ padding: "1rem 0" }}>842 tokens</td>
                                <td style={{ padding: "1rem 0" }}>2m ago</td>
                            </tr>
                            <tr>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>Analyze VPC Flow Logs</td>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}><span style={{ color: "#f59e0b" }}>Pending Approval</span></td>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>1,200 tokens</td>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>15m ago</td>
                            </tr>
                            <tr>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>Describe EC2 Configurations</td>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}><span style={{ color: "#10b981" }}>Success (Verified)</span></td>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>450 tokens</td>
                                <td style={{ padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>1h ago</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ marginTop: "2rem", textAlign: "center" }}>
                        <Link href="/" className="btn btn-secondary">
                            ← Return Home
                        </Link>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    <div className="glass-panel" style={{ padding: "2rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                            <ShieldCheck size={24} style={{ color: "#10b981" }} />
                            <h2 style={{ fontSize: "1.25rem" }}>System Health</h2>
                        </div>
                        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <li style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Knowledge Bases</span>
                                <span style={{ color: "#10b981" }}>Online</span>
                            </li>
                            <li style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Approval Gateway</span>
                                <span style={{ color: "#10b981" }}>Online</span>
                            </li>
                            <li style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Reasoning Engine</span>
                                <span style={{ color: "#10b981" }}>Online</span>
                            </li>
                        </ul>
                    </div>

                    <div className="glass-panel" style={{ padding: "2rem" }}>
                        <h2 style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>Free-Tier Usage</h2>
                        <div style={{ marginBottom: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Lambda Invocations</span>
                                <span>12%</span>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.1)", height: "4px", borderRadius: "2px" }}>
                                <div style={{ width: "12%", height: "100%", background: "var(--brand-primary)", borderRadius: "2px" }} />
                            </div>
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Bedrock Tokens</span>
                                <span>45%</span>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.1)", height: "4px", borderRadius: "2px" }}>
                                <div style={{ width: "45%", height: "100%", background: "var(--accent)", borderRadius: "2px" }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
