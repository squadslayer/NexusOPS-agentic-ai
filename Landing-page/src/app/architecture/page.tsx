import { Workflow } from '@/components/Workflow';
import { Integrations } from '@/components/Integrations';

export default function ArchitecturePage() {
    return (
        <div className="pt-24 lg:pt-32 pb-16">
            <div className="layout-container text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
                    System Architecture
                </h1>
                <p className="text-xl text-text-secondary max-w-3xl mx-auto">
                    A deep dive into how NexusOPS orchestrates state transitions securely across distributed systems.
                </p>
            </div>
            <Workflow />
            <Integrations />
        </div>
    );
}
