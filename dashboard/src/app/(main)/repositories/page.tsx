import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { RepoList } from "@/components/github/RepoList";
import { GitHubConnect } from "@/components/github/connect";

export const metadata: Metadata = { title: "Repositories" };

export default function RepositoriesPage() {
    return (
        <PageContainer
            heading="GitHub Repositories"
            description="Manage your connected GitHub repositories and trigger anomaly analysis."
            actions={<GitHubConnect />}
        >
            <div className="mt-6">
                <RepoList />
            </div>
        </PageContainer>
    );
}
