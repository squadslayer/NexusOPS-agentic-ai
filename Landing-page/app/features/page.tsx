import { FileText, Cpu, CheckCircle, Search, Play } from "lucide-react";

export default function Features() {
    return (
        <div className="animate-fade-in relative z-10 w-full overflow-hidden container" style={{ padding: "6rem 2rem 8rem" }}>
            <div className="bg-gradient-glow" style={{ top: "40%", left: "30%" }}></div>

            <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", marginBottom: "4rem" }}>
                <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", marginBottom: "1rem" }}>Core Features</h1>
                <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)" }}>
                    Every interaction follows a strictly enforced 5-step agentic loop built around RAG and constrained reasoning.
                </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "800px", margin: "0 auto" }}>
                {/* Step 1 */}
                <div className="glass-panel" style={{ padding: "2rem", display: "flex", gap: "1.5rem" }}>
                    <div style={{ background: "rgba(59, 130, 246, 0.1)", minWidth: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)", fontWeight: "bold", fontSize: "1.2rem" }}>
                        1
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Search size={24} /> Ask
                        </h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            The Query Handler validates format and content, rejecting potentially unsafe prompts immediately before proceeding.
                        </p>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="glass-panel delay-100" style={{ padding: "2rem", display: "flex", gap: "1.5rem" }}>
                    <div style={{ background: "rgba(139, 92, 246, 0.1)", minWidth: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-secondary)", fontWeight: "bold", fontSize: "1.2rem" }}>
                        2
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FileText size={24} /> Retrieve
                        </h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Amazon Bedrock Knowledge Bases perform vector similarity search on allowed internal docs. Citations are strictly required. Sub-0.7 confidence results are discarded.
                        </p>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="glass-panel delay-200" style={{ padding: "2rem", display: "flex", gap: "1.5rem" }}>
                    <div style={{ background: "rgba(244, 63, 94, 0.1)", minWidth: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontWeight: "bold", fontSize: "1.2rem" }}>
                        3
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Cpu size={24} /> Reason
                        </h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Direct base model invocation utilizing Titan Text G1 or Claude 3 Haiku for bounded single-step reasoning logic. Highlighting constraints and failure modes is enforced.
                        </p>
                    </div>
                </div>

                {/* Step 4 */}
                <div className="glass-panel delay-300" style={{ padding: "2rem", display: "flex", gap: "1.5rem" }}>
                    <div style={{ background: "rgba(16, 185, 129, 0.1)", minWidth: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", fontWeight: "bold", fontSize: "1.2rem" }}>
                        4
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Play size={24} /> Act
                        </h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Action Registry matches tasks strictly to allowlisted Lambdas. Requires Human-in-the-Loop Gateway approval prior to invocation of critical resources.
                        </p>
                    </div>
                </div>

                {/* Step 5 */}
                <div className="glass-panel delay-300" style={{ padding: "2rem", display: "flex", gap: "1.5rem" }}>
                    <div style={{ background: "rgba(245, 158, 11, 0.1)", minWidth: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", fontWeight: "bold", fontSize: "1.2rem" }}>
                        5
                    </div>
                    <div>
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <CheckCircle size={24} /> Verify
                        </h3>
                        <p style={{ color: "var(--text-secondary)" }}>
                            Cross-validation of outcome against the retrieved material. Reversible idempotent actions are auto-rolled back upon verification failure.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
