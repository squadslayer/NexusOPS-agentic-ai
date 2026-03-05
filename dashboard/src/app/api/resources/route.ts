import { NextResponse } from "next/server";

export type ResourceItem = {
    id: string;
    name: string;
    type: string;
    region: string;
    account: string;
    status: "compliant" | "non-compliant" | "unknown";
};

const RESOURCES: ResourceItem[] = [
    { id: "r-001", name: "prod-data-lake-raw", type: "S3 Bucket", region: "us-east-1", account: "prod-account", status: "non-compliant" },
    { id: "r-002", name: "i-0a1b2c3d4e5f67890", type: "EC2 Instance", region: "eu-west-1", account: "staging-account", status: "non-compliant" },
    { id: "r-003", name: "db-prod-mysql-01", type: "RDS Instance", region: "us-east-1", account: "prod-account", status: "non-compliant" },
    { id: "r-004", name: "prod-api-gateway", type: "API Gateway", region: "us-east-1", account: "prod-account", status: "compliant" },
    { id: "r-005", name: "iam-admin-role", type: "IAM Role", region: "global", account: "prod-account", status: "compliant" },
    { id: "r-006", name: "cloudtrail-org-trail", type: "CloudTrail", region: "us-east-1", account: "prod-account", status: "compliant" },
    { id: "r-007", name: "lambda-remediate", type: "Lambda Function", region: "us-east-1", account: "prod-account", status: "compliant" },
    { id: "r-008", name: "vpc-prod-main", type: "VPC", region: "us-east-1", account: "prod-account", status: "compliant" },
    { id: "r-009", name: "sg-0fedcba987654321", type: "Security Group", region: "us-west-2", account: "staging-account", status: "non-compliant" },
    { id: "r-010", name: "eks-cluster-prod", type: "EKS Cluster", region: "us-east-1", account: "prod-account", status: "compliant" },
];

export async function GET() {
    return NextResponse.json(RESOURCES);
}
