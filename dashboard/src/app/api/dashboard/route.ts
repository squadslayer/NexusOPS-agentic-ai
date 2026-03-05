import { NextResponse } from "next/server";

/** 7-day resource trend (most-recent day last) */
const TREND_DATA = [
    { date: "Feb 23", count: 4612 },
    { date: "Feb 24", count: 4659 },
    { date: "Feb 25", count: 4701 },
    { date: "Feb 26", count: 4744 },
    { date: "Feb 27", count: 4780 },
    { date: "Feb 28", count: 4803 },
    { date: "Mar 01", count: 4821 },
];

const PAYLOAD = {
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

export async function GET() {
    return NextResponse.json(PAYLOAD);
}
