import React from 'react';
import { Github, Slack } from 'lucide-react';

export function Integrations() {
    return (
        <section className="py-section border-b border-white/5 bg-background">
            <div className="layout-container flex flex-col items-center">

                <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 items-center justify-items-center opacity-50 grayscale transition-opacity hover:opacity-70">

                    {/* AWS Logo (Typographic Placeholder) */}
                    <div className="flex items-center justify-center font-bold text-2xl tracking-tighter text-white">
                        aws
                    </div>

                    {/* GitHub */}
                    <div className="flex items-center gap-2 justify-center text-white">
                        <Github className="w-8 h-8" />
                        <span className="font-semibold text-xl tracking-tight hidden sm:block">GitHub</span>
                    </div>

                    {/* Slack */}
                    <div className="flex items-center gap-2 justify-center text-white">
                        <Slack className="w-8 h-8" />
                        <span className="font-semibold text-xl tracking-tight hidden sm:block">Slack</span>
                    </div>

                    {/* Amazon Bedrock */}
                    <div className="flex items-center justify-center font-semibold text-xl tracking-tight text-white text-center">
                        Amazon Bedrock
                    </div>

                </div>

            </div>
        </section>
    );
}
