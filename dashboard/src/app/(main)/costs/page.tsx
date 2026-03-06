import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Cost Anomalies" };

export default function CostsPage() {
    return (
        <PageContainer
            heading="Cost Anomalies"
            description="Track unexpected AWS cost spikes and receive remediation suggestions."
        >
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <WrenchScrewdriverIcon className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-textMain mb-2">Coming Soon</h2>
                <p className="text-sm text-textSub max-w-md">
                    Cost Anomaly detection is currently under development.
                    Financial governance workflows will land in a future release.
                </p>
            </div>
        </PageContainer>
    );
}
