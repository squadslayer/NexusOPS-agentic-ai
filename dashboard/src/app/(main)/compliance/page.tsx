import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { ViolationsTable } from "@/components/charts/ViolationsTable";
import type { ViolationItem } from "@/components/charts/ViolationsTable";

export const metadata: Metadata = { title: "Policy Violations" };

// Inline data — avoids self-fetch port issues in dev.
const VIOLATIONS: ViolationItem[] = [
    { id: "v-001", rule: "S3 bucket public access enabled", resource: "s3://prod-data-lake-raw", account: "prod-account (123456789012)", region: "us-east-1", severity: "CRITICAL", detectedAt: "2026-03-01T10:14:00Z" },
    { id: "v-002", rule: "IAM root account has active access key", resource: "arn:aws:iam::123456789012:root", account: "prod-account (123456789012)", region: "global", severity: "CRITICAL", detectedAt: "2026-03-01T09:02:00Z" },
    { id: "v-003", rule: "EC2 instance with unrestricted SSH (0.0.0.0/0)", resource: "i-0a1b2c3d4e5f67890", account: "staging-account (210987654321)", region: "eu-west-1", severity: "HIGH", detectedAt: "2026-02-28T22:41:00Z" },
    { id: "v-004", rule: "CloudTrail logging disabled in region", resource: "ap-southeast-1", account: "dev-account (345678901234)", region: "ap-southeast-1", severity: "HIGH", detectedAt: "2026-02-28T18:30:00Z" },
    { id: "v-005", rule: "RDS instance not encrypted at rest", resource: "db-prod-mysql-01", account: "prod-account (123456789012)", region: "us-east-1", severity: "HIGH", detectedAt: "2026-02-28T15:12:00Z" },
    { id: "v-006", rule: "Security Group allows unrestricted RDP", resource: "sg-0fedcba987654321", account: "staging-account (210987654321)", region: "us-west-2", severity: "HIGH", detectedAt: "2026-02-27T11:00:00Z" },
    { id: "v-007", rule: "Lambda function without resource-based policy", resource: "remediate-untagged-resources", account: "prod-account (123456789012)", region: "us-east-1", severity: "MEDIUM", detectedAt: "2026-02-27T08:45:00Z" },
    { id: "v-008", rule: "EC2 instance missing required tags (team, env)", resource: "i-0b2c3d4e5f6789012", account: "dev-account (345678901234)", region: "us-east-1", severity: "LOW", detectedAt: "2026-02-26T16:22:00Z" },
    { id: "v-009", rule: "S3 bucket versioning disabled", resource: "s3://staging-artifacts-bucket", account: "staging-account (210987654321)", region: "us-east-1", severity: "MEDIUM", detectedAt: "2026-02-26T14:10:00Z" },
    { id: "v-010", rule: "IAM policy allows wildcard '*' actions", resource: "arn:aws:iam::345678901234:policy/DevFullAccess", account: "dev-account (345678901234)", region: "global", severity: "HIGH", detectedAt: "2026-02-25T10:00:00Z" },
    { id: "v-011", rule: "EKS cluster endpoint publicly accessible", resource: "eks-cluster-prod", account: "prod-account (123456789012)", region: "us-east-1", severity: "CRITICAL", detectedAt: "2026-02-25T08:30:00Z" },
    { id: "v-012", rule: "VPC Flow Logs not enabled", resource: "vpc-prod-main", account: "prod-account (123456789012)", region: "us-east-1", severity: "MEDIUM", detectedAt: "2026-02-24T12:00:00Z" },
    { id: "v-013", rule: "Secrets Manager rotation disabled", resource: "prod/db/password", account: "prod-account (123456789012)", region: "us-east-1", severity: "HIGH", detectedAt: "2026-02-24T09:15:00Z" },
    { id: "v-014", rule: "EBS volume not encrypted", resource: "vol-0a1b2c3d4e5f67890", account: "staging-account (210987654321)", region: "eu-west-1", severity: "MEDIUM", detectedAt: "2026-02-23T16:45:00Z" },
    { id: "v-015", rule: "CloudWatch alarm missing for root API calls", resource: "prod-account (123456789012)", account: "prod-account (123456789012)", region: "us-east-1", severity: "LOW", detectedAt: "2026-02-22T11:30:00Z" },
];

/**
 * /compliance — Policy Violations page.
 * Server component: passes inline violation data to client ViolationsTable.
 */
export default async function CompliancePage() {
    return (
        <PageContainer
            heading="Policy Violations"
            description="All open compliance findings across AWS accounts, sorted by severity."
            actions={
                <button type="button" className="btn-primary text-xs">
                    Export Report
                </button>
            }
        >
            <ViolationsTable violations={VIOLATIONS} />
        </PageContainer>
    );
}
