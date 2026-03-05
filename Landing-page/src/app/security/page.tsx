import { Security as SecurityComponent } from '@/components/Security';

export default function SecurityPage() {
    return (
        <div className="pt-24 lg:pt-32 pb-16">
            <div className="layout-container text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
                    Governance & Policy
                </h1>
                <p className="text-xl text-text-secondary max-w-3xl mx-auto">
                    Immutable constraints, automated compliance, and complete visibility.
                </p>
            </div>
            <SecurityComponent />
        </div>
    );
}
