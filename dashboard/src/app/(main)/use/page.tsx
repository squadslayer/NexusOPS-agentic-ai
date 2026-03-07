import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = { title: "Use Cases" };

const USE_CASES = [
    {
        tag: "Security",
        title: "Continuous Compliance Monitoring",
        description:
            "Automatically evaluate AWS resources against CIS, NIST, and custom organizational policies — surfacing violations in real time.",
        services: ["AWS Config", "Security Hub"],
    },
    {
        tag: "Cost",
        title: "Cost Anomaly Detection",
        description:
            "Detect unusual spend patterns across linked accounts and alert the owning team before costs escalate.",
        services: ["Cost Explorer", "EventBridge"],
    },
    {
        tag: "Operations",
        title: "Tagging Governance",
        description:
            "Enforce mandatory tags (team, environment, cost-center) and auto-remediate untagged resources via Lambda runbooks.",
        services: ["AWS Config", "Lambda", "Organizations"],
    },
    {
        tag: "IAM",
        title: "Least-Privilege Access Reviews",
        description:
            "Periodically analyse IAM policies to identify over-privileged roles and generate remediation recommendations.",
        services: ["IAM Access Analyzer", "CloudTrail"],
    },
    {
        tag: "Audit",
        title: "Immutable Audit Trails",
        description:
            "Centralise CloudTrail logs across all accounts into a security-hardened, tamper-evident audit store.",
        services: ["CloudTrail", "S3", "Lake Formation"],
    },
    {
        tag: "Remediation",
        title: "Automated Incident Response",
        description:
            "Trigger Lambda-backed runbooks on EventBridge events to automatically quarantine, remediate, or notify on policy breaches.",
        services: ["EventBridge", "Lambda", "SNS"],
    },
];

const TAG_COLORS: Record<string, string> = {
    Security: "badge-danger",
    Cost: "badge-warning",
    Operations: "badge-info",
    IAM: "badge-neutral",
    Audit: "badge-neutral",
    Remediation: "badge-success",
};

/**
 * /use — Use Cases page.
 * Static presentational content only.
 */
export default function UsePage() {
    return (
        <PageContainer
            heading="Use Cases"
            description="Key governance scenarios NexusOps is built to address."
        >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {USE_CASES.map(({ tag, title, description, services }) => (
                    <div key={title} className="card space-y-3 flex flex-col">
                        <div className="flex items-center justify-between">
                            <span className={TAG_COLORS[tag] ?? "badge-neutral"}>{tag}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-textMain">{title}</h3>
                        <p className="text-sm text-textSub leading-relaxed flex-1">{description}</p>
                        <div className="pt-2 border-t border-divider flex flex-wrap gap-1">
                            {services.map((svc) => (
                                <span key={svc} className="badge badge-neutral text-2xs font-mono">
                                    {svc}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </PageContainer>
    );
}
