import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = { title: "AWS Resources" };

const AWS_SERVICES = [
    { name: "AWS Config", role: "Continuous compliance recording", status: "active" },
    { name: "AWS IAM", role: "Identity & access governance", status: "active" },
    { name: "AWS Organizations", role: "Multi-account structure & SCPs", status: "active" },
    { name: "AWS CloudTrail", role: "API audit log and forensics", status: "active" },
    { name: "AWS Security Hub", role: "Aggregated security findings", status: "active" },
    { name: "AWS Cost Explorer", role: "Cost attribution & anomaly detection", status: "active" },
    { name: "Amazon EventBridge", role: "Event-driven policy enforcement", status: "planned" },
    { name: "AWS Lambda", role: "Serverless remediation actions", status: "planned" },
] as const;

type Status = "active" | "planned";

const STATUS_BADGE: Record<Status, string> = {
    active: "badge-success",
    planned: "badge-neutral",
};

/**
 * /aws — AWS Services & Resources reference page.
 * Static content only.
 */
export default function AwsPage() {
    return (
        <PageContainer
            heading="AWS Resources"
            description="Core AWS services integrated into the NexusOps governance platform."
        >
            <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-background">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide">
                                Service
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide">
                                Role
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                        {AWS_SERVICES.map(({ name, role, status }) => (
                            <tr key={name} className="hover:bg-surfaceHover transition-colors">
                                <td className="px-4 py-3 font-medium text-textMain">{name}</td>
                                <td className="px-4 py-3 text-textSub">{role}</td>
                                <td className="px-4 py-3">
                                    <span className={STATUS_BADGE[status]}>{status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageContainer>
    );
}
