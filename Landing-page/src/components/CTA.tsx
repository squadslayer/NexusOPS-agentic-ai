import React from 'react';
import Link from 'next/link';

export function CTA() {
    return (
        <section className="py-section border-b border-white/5 bg-background">
            <div className="layout-container">

                <div className="text-center max-w-3xl mx-auto flex flex-col items-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-6 tracking-tight">
                        Deploy Safer. Move Faster.
                    </h2>

                    <p className="text-xl text-text-secondary leading-relaxed mb-10">
                        NexusOPS transforms intent into verified execution.
                    </p>

                    <Link href="/deploy" className="inline-block bg-primary hover:bg-primary/90 text-white font-medium px-10 py-4 rounded-md transition-colors text-lg">
                        Deploy NexusOPS
                    </Link>
                </div>

            </div>
        </section>
    );
}
