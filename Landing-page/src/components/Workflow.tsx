import React from 'react';
import { ArrowRight, ArrowDown, HelpCircle, Database, BrainCircuit, Play, CheckCircle2 } from 'lucide-react';

const steps = [
    {
        id: 'ask',
        title: 'Ask',
        description: 'Natural language intent parsing',
        icon: <HelpCircle className="w-5 h-5 text-primary" />,
    },
    {
        id: 'retrieve',
        title: 'Retrieve',
        description: 'Context and state fetching',
        icon: <Database className="w-5 h-5 text-primary" />,
    },
    {
        id: 'reason',
        title: 'Reason',
        description: 'Execution path synthesis',
        icon: <BrainCircuit className="w-5 h-5 text-primary" />,
    },
    {
        id: 'act',
        title: 'Act',
        description: 'Deterministic infrastructure changes',
        icon: <Play className="w-5 h-5 text-primary" />,
    },
    {
        id: 'verify',
        title: 'Verify',
        description: 'Post-flight state validation',
        icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
    },
];

export function Workflow() {
    return (
        <section className="py-section border-b border-white/5 bg-background">
            <div className="layout-container">

                <div className="text-center mb-16 mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
                        The Intelligent Execution Loop
                    </h2>
                    <p className="text-lg text-text-secondary">
                        Every action flows through deterministic validation before execution.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
                    {steps.map((step, index) => (
                        <React.Fragment key={step.id}>

                            {/* Step Card */}
                            <div className="flex-1 w-full lg:w-auto bg-surface border border-white/5 rounded-card p-6 transition-all duration-300 hover:border-white/20 hover:-translate-y-1 shadow-sm hover:shadow-md hover:shadow-primary/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-background w-10 h-10 flex items-center justify-center rounded-lg border border-white/5">
                                        {step.icon}
                                    </div>
                                    <h3 className="text-lg font-semibold text-text-primary">{step.title}</h3>
                                </div>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    {step.description}
                                </p>
                            </div>

                            {/* Arrow separator (hidden on last item) */}
                            {index < steps.length - 1 && (
                                <div className="flex-shrink-0 text-white/10 hidden lg:flex items-center justify-center w-8">
                                    <ArrowRight className="w-5 h-5" />
                                </div>
                            )}
                            {index < steps.length - 1 && (
                                <div className="flex-shrink-0 text-white/10 flex lg:hidden items-center justify-center h-8">
                                    <ArrowDown className="w-5 h-5" />
                                </div>
                            )}

                        </React.Fragment>
                    ))}
                </div>

            </div>
        </section>
    );
}
