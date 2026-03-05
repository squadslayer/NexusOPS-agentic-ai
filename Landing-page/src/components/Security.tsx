import React from 'react';
import { ShieldCheck } from 'lucide-react';

const securityFeatures = [
    'IAM-scoped execution',
    'Approval gateway',
    'Immutable audit logging',
    'Deterministic constraint engine'
];

export function Security() {
    return (
        <section className="py-section border-b border-white/5 bg-background">
            <div className="layout-container">

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10">

                    <div className="max-w-xl">
                        <h2 className="text-3xl font-bold text-text-primary mb-4">
                            Enterprise-Grade Governance
                        </h2>
                        <p className="text-lg text-text-secondary leading-relaxed mb-8">
                            Security is not an afterthought; it is baked into the execution loop. Every operation is evaluated against your organization&apos;s compliance thresholds before any infrastructure is mutated.
                        </p>
                    </div>

                    <div className="w-full md:w-auto flex-shrink-0 bg-surface border border-white/10 rounded-card p-8">
                        <ul className="space-y-4">
                            {securityFeatures.map((feature, idx) => (
                                <li key={idx} className="flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-text-secondary" />
                                    <span className="text-text-primary font-medium">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

            </div>
        </section>
    );
}
