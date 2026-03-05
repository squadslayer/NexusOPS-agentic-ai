import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import {
    ChartBarSquareIcon,
    CloudIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import { ResourceTrendChart } from "@/components/charts/ResourceTrendChart";
import { ViolationsList } from "@/components/charts/ViolationsList";

export const metadata: Metadata = { title: "Dashboard" };

// ─── Types ────────────────────────────────────────────────────────────────────

type TrendPoint = { date: string; count: number };

type DashboardData = {
    totalResources: number;
    resourceDelta: string;
    policyViolations: number;
    violationDelta: string;
    compliancePercent: number;
    complianceDelta: string;
    costAnomalies: number;
    anomalyDelta: string;
    trend: TrendPoint[];
};

type Violation = {
    id: string;
    rule: string;
    resource: string;
    account: string;
    region: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    detectedAt: string;
};

// ─── Inline data (avoids self-fetch port issues in dev) ───────────────────────

const TREND_DATA: TrendPoint[] = [
    { date: "Feb 23", count: 4612 },
    { date: "Feb 24", count: 4659 },
    { date: "Feb 25", count: 4701 },
    { date: "Feb 26", count: 4744 },
    { date: "Feb 27", count: 4780 },
    { date: "Feb 28", count: 4803 },
    { date: "Mar 01", count: 4821 },
];

const DASHBOARD_DATA: DashboardData = {
    totalResources: 4821,
    resourceDelta: "+3.2%",
    policyViolations: 128,
    violationDelta: "-12%",
    compliancePercent: 97.4,
    complianceDelta: "+0.8%",
    costAnomalies: 7,
    anomalyDelta: "+2",
    trend: TREND_DATA,
};

const VIOLATIONS_DATA: Violation[] = [
    { id: "v-001", rule: "S3 bucket public access enabled", resource: "s3://prod-data-lake-raw", account: "prod-account (123456789012)", region: "us-east-1", severity: "CRITICAL", detectedAt: "2026-03-01T10:14:00Z" },
    { id: "v-002", rule: "IAM root account has active access key", resource: "arn:aws:iam::123456789012:root", account: "prod-account (123456789012)", region: "global", severity: "CRITICAL", detectedAt: "2026-03-01T09:02:00Z" },
    { id: "v-003", rule: "EC2 instance with unrestricted SSH (0.0.0.0/0)", resource: "i-0a1b2c3d4e5f67890", account: "staging-account (210987654321)", region: "eu-west-1", severity: "HIGH", detectedAt: "2026-02-28T22:41:00Z" },
    { id: "v-004", rule: "CloudTrail logging disabled in region", resource: "ap-southeast-1", account: "dev-account (345678901234)", region: "ap-southeast-1", severity: "HIGH", detectedAt: "2026-02-28T18:30:00Z" },
    { id: "v-005", rule: "RDS instance not encrypted at rest", resource: "db-prod-mysql-01", account: "prod-account (123456789012)", region: "us-east-1", severity: "HIGH", detectedAt: "2026-02-28T15:12:00Z" },
    { id: "v-006", rule: "Security Group allows unrestricted RDP", resource: "sg-0fedcba987654321", account: "staging-account (210987654321)", region: "us-west-2", severity: "HIGH", detectedAt: "2026-02-27T11:00:00Z" },
];

async function getDashboardData(): Promise<DashboardData> {
    return DASHBOARD_DATA;
}

async function getViolations(): Promise<Violation[]> {
    return VIOLATIONS_DATA;
}

// ─── Delta badge helper ───────────────────────────────────────────────────────

function DeltaBadge({ delta, positiveIsGood = true }: { delta: string; positiveIsGood?: boolean }) {
    const isPositive = delta.startsWith("+");
    const isGood = positiveIsGood ? isPositive : !isPositive;
    const Icon = isPositive ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    return (
        <span className={`flex items-center gap-1 text-xs font-medium ${isGood ? "text-successText" : "text-dangerText"}`}>
            <Icon className="h-3 w-3" aria-hidden />
            {delta} from last 7d
        </span>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
    const [data, violations] = await Promise.all([getDashboardData(), getViolations()]);

    const SUMMARY_CARDS = [
        {
            label: "Total AWS Resources",
            value: data.totalResources.toLocaleString(),
            delta: data.resourceDelta,
            positiveIsGood: true,
            icon: CloudIcon,
        },
        {
            label: "Policy Violations",
            value: data.policyViolations.toLocaleString(),
            delta: data.violationDelta,
            positiveIsGood: false,
            icon: ExclamationTriangleIcon,
        },
        {
            label: "Compliant Accounts",
            value: `${data.compliancePercent}%`,
            delta: data.complianceDelta,
            positiveIsGood: true,
            icon: ShieldCheckIcon,
        },
        {
            label: "Cost Anomalies",
            value: String(data.costAnomalies),
            delta: data.anomalyDelta,
            positiveIsGood: false,
            icon: ChartBarSquareIcon,
        },
    ];

    return (
        <PageContainer
            heading="Dashboard"
            description="Real-time overview of your cloud governance posture across all AWS accounts."
            actions={
                <button type="button" className="btn-primary text-xs">
                    Export Report
                </button>
            }
        >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {SUMMARY_CARDS.map(({ label, value, delta, positiveIsGood, icon: Icon }) => (
                    <div key={label} className="card flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-textMuted uppercase tracking-wide">{label}</p>
                            <Icon className="h-4 w-4 text-textMuted" aria-hidden />
                        </div>
                        <p className="text-2xl font-semibold text-textMain">{value}</p>
                        <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} />
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                {/* Resource Trend Chart */}
                <div className="lg:col-span-2 card flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-textMain">Resource Inventory Trend</p>
                            <p className="text-xs text-textMuted mt-0.5">Total AWS resources — last 7 days</p>
                        </div>
                    </div>
                    <div className="h-56">
                        <ResourceTrendChart data={data.trend} />
                    </div>
                </div>

                {/* Top Violations */}
                <div className="card flex flex-col gap-3">
                    <div>
                        <p className="text-sm font-semibold text-textMain">Top Policy Violations</p>
                        <p className="text-xs text-textMuted mt-0.5">Most recent open findings</p>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <ViolationsList violations={violations.slice(0, 6)} />
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
