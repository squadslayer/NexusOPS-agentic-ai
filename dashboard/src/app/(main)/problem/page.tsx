import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = { title: "Problem Statement" };

const CHALLENGES = [
    {
        title: "Lack of Centralized Visibility",
        body: "Organizations running workloads across multiple AWS accounts and regions have no single pane of glass for resource inventory, access, and compliance state.",
    },
    {
        title: "Policy Drift at Scale",
        body: "Security and tagging policies diverge over time as teams provision resources independently, resulting in ungoverned sprawl and audit failures.",
    },
    {
        title: "Reactive Incident Response",
        body: "Without continuous compliance monitoring, policy violations are discovered post-incident rather than prevented proactively, increasing breach exposure.",
    },
    {
        title: "Cost Attribution Complexity",
        body: "Inconsistent tagging and multi-account structures make accurate cost attribution to teams, products, and environments difficult without tooling.",
    },
];

/**
 * /problem — Problem Statement page.
 * Static descriptive content. No business logic.
 */
export default function ProblemPage() {
    return (
        <PageContainer
            heading="Problem Statement"
            description="Key cloud governance challenges this platform is designed to solve."
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CHALLENGES.map(({ title, body }, i) => (
                    <div key={title} className="card space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-2xs font-mono text-textMuted">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <h3 className="text-sm font-semibold text-textMain">{title}</h3>
                        </div>
                        <p className="text-sm text-textSub leading-relaxed">{body}</p>
                    </div>
                ))}
            </div>
        </PageContainer>
    );
}
