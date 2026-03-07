import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = { title: "Vision" };

const PILLARS = [
    {
        number: "01",
        title: "Unified Observability",
        body: "A single, consistent view of all cloud resources, relationships, and compliance states across every AWS account and region.",
    },
    {
        number: "02",
        title: "Proactive Governance",
        body: "Shift from reactive incident response to proactive policy enforcement — catching violations before they reach production.",
    },
    {
        number: "03",
        title: "Automated Remediation",
        body: "Reduce manual toil by automatically correcting well-known compliance drift patterns using AWS Lambda-backed runbooks.",
    },
    {
        number: "04",
        title: "Transparent Cost Accountability",
        body: "Give every team accurate, real-time cost attribution tied to product, environment, and business unit dimensions.",
    },
];

/**
 * /vision — Product Vision page.
 * Static content only.
 */
export default function VisionPage() {
    return (
        <PageContainer
            heading="Vision"
            description="The long-term goals that guide NexusOps's product direction."
        >
            {/* Vision statement */}
            <blockquote className="border-l-2 border-primary pl-4 py-1 mb-6">
                <p className="text-base text-textMain font-medium leading-relaxed">
                    &ldquo;Provide every engineering and security team with the clarity and automation they need to own their cloud posture — at any scale.&rdquo;
                </p>
            </blockquote>

            {/* Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PILLARS.map(({ number, title, body }) => (
                    <div key={number} className="card space-y-2">
                        <p className="section-label">{number}</p>
                        <h3 className="text-sm font-semibold text-textMain">{title}</h3>
                        <p className="text-sm text-textSub leading-relaxed">{body}</p>
                    </div>
                ))}
            </div>
        </PageContainer>
    );
}
