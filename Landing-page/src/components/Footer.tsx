import React from 'react';
import Link from 'next/link';
import { Command } from 'lucide-react';

export function Footer() {
    return (
        <footer className="border-t border-white/5 bg-background py-12 text-sm text-text-secondary">
            <div className="layout-container grid-12 gap-y-10">
                <div className="col-span-12 md:col-span-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Command className="w-5 h-5 text-primary" />
                        <span className="text-text-primary font-bold">NexusOPS</span>
                    </div>
                    <p className="max-w-xs mb-6">
                        Enterprise infrastructure management platform for accelerating development velocity safely.
                    </p>
                    <p>© {new Date().getFullYear()} NexusOPS Inc. All rights reserved.</p>
                </div>

                <div className="col-span-6 md:col-span-2 md:col-start-7">
                    <h4 className="text-text-primary font-medium mb-4">Platform</h4>
                    <ul className="space-y-3">
                        <li><Link href="/architecture" className="hover:text-text-primary transition-colors">Architecture</Link></li>
                        <li><Link href="/features" className="hover:text-text-primary transition-colors">Features</Link></li>
                        <li><Link href="/security" className="hover:text-text-primary transition-colors">Security</Link></li>
                        <li><Link href={process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000/dashboard"} className="hover:text-text-primary transition-colors">Open Dashboard</Link></li>
                    </ul>
                </div>

                <div className="col-span-6 md:col-span-2">
                    <h4 className="text-text-primary font-medium mb-4">Connect</h4>
                    <ul className="space-y-3">
                        <li><Link href="https://github.com/squadslayer/NexusOPS-agentic-ai" className="hover:text-text-primary transition-colors">GitHub Repository</Link></li>
                    </ul>
                </div>
            </div>
        </footer>
    );
}
