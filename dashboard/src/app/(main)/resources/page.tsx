import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Resources" };

export default function ResourcesPage() {
    return (
        <PageContainer
            heading="AWS Resources"
            description="Global view of all tracked AWS resources across linked accounts."
        >
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <WrenchScrewdriverIcon className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-textMain mb-2">Coming Soon</h2>
                <p className="text-sm text-textSub max-w-md">
                    The Global Resource Inventory is currently being integrated with the ingestion graph.
                </p>
            </div>
        </PageContainer>
    );
}
