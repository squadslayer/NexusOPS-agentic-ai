import React from 'react';
import { ShieldCheck, CircleDollarSign, Fingerprint, GitPullRequestDraft } from 'lucide-react';

const features = [
    {
        id: 'guardrails',
        title: 'Deterministic Guardrails',
        description: 'Prevent misconfigurations before they deploy with strict policy-as-code enforcement.',
        icon: <ShieldCheck className="w-5 h-5 text-primary" />,
    },
    {
        id: 'cost',
        title: 'Cost-Aware Automation',
        description: 'Automatic resource rightsizing and sunsetting based on utilization metrics natively.',
        icon: <CircleDollarSign className="w-5 h-5 text-primary" />,
    },
    {
        id: 'logging',
        title: 'Tamper-Evident Logging',
        description: 'Immutable audit trails for every API call, state mutation, and access event.',
        icon: <Fingerprint className="w-5 h-5 text-primary" />,
    },
    {
        id: 'approval',
        title: 'Approval Gateway',
        description: 'Multi-stage human-in-the-loop approvals for sensitive infrastructure changes.',
        icon: <GitPullRequestDraft className="w-5 h-5 text-primary" />,
    }
];

export function Features() {
    return (
        <section className="py-section border-b border-white/5 bg-background">
            <div className="layout-container">

                <div className="mb-16">
                    <h2 className="text-3xl font-bold text-text-primary mb-4">
                        Core Capabilities
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="bg-surface border border-white/5 rounded-card p-6 transition-all duration-300 hover:border-white/10 hover:-translate-y-0.5"
                        >
                            <div className="bg-background w-10 h-10 flex items-center justify-center rounded-lg border border-white/5 mb-6">
                                {feature.icon}
                            </div>
                            <h3 className="text-lg font-semibold text-text-primary mb-3">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
}
