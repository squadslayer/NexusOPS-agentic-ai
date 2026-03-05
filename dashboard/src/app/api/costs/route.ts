import { NextResponse } from "next/server";

export type CostAnomaly = {
    id: string;
    service: string;
    account: string;
    region: string;
    expectedUsd: number;
    actualUsd: number;
    detectedAt: string;
    description: string;
};

const COST_ANOMALIES: CostAnomaly[] = [
    {
        id: "ca-001",
        service: "Amazon EC2",
        account: "prod-account (123456789012)",
        region: "us-east-1",
        expectedUsd: 3200,
        actualUsd: 5840,
        detectedAt: "2026-03-01T08:00:00Z",
        description: "Spike in On-Demand instance usage — possible runaway ASG scale-out event.",
    },
    {
        id: "ca-002",
        service: "Amazon S3",
        account: "prod-account (123456789012)",
        region: "us-east-1",
        expectedUsd: 420,
        actualUsd: 1190,
        detectedAt: "2026-02-28T14:00:00Z",
        description: "Unexpected data-transfer-out surge from prod-data-lake-raw bucket.",
    },
    {
        id: "ca-003",
        service: "AWS Lambda",
        account: "staging-account (210987654321)",
        region: "eu-west-1",
        expectedUsd: 80,
        actualUsd: 540,
        detectedAt: "2026-02-28T10:30:00Z",
        description: "Lambda invocation count 6x above baseline — likely infinite retry loop.",
    },
    {
        id: "ca-004",
        service: "Amazon RDS",
        account: "prod-account (123456789012)",
        region: "us-east-1",
        expectedUsd: 950,
        actualUsd: 1580,
        detectedAt: "2026-02-27T22:00:00Z",
        description: "Multi-AZ failover triggered additional I/O charges on db-prod-mysql-01.",
    },
    {
        id: "ca-005",
        service: "Amazon CloudFront",
        account: "staging-account (210987654321)",
        region: "global",
        expectedUsd: 110,
        actualUsd: 390,
        detectedAt: "2026-02-27T16:00:00Z",
        description: "Cache hit rate dropped to 12% — origin requests surged causing transfer cost.",
    },
    {
        id: "ca-006",
        service: "AWS Glue",
        account: "dev-account (345678901234)",
        region: "ap-southeast-1",
        expectedUsd: 60,
        actualUsd: 310,
        detectedAt: "2026-02-26T09:00:00Z",
        description: "Glue ETL job ran 5 redundant times due to mis-configured schedule trigger.",
    },
    {
        id: "ca-007",
        service: "Amazon EKS",
        account: "prod-account (123456789012)",
        region: "us-east-1",
        expectedUsd: 1400,
        actualUsd: 2050,
        detectedAt: "2026-02-25T18:00:00Z",
        description: "Node group over-provisioned after cluster upgrade — unused capacity lingering.",
    },
];

export async function GET() {
    return NextResponse.json(COST_ANOMALIES);
}
