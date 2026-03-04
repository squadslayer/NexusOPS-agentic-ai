"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export function Hero() {
    return (
        <section className="min-h-[80vh] flex flex-col justify-center py-section border-b border-white/5 relative bg-background pt-32 lg:pt-40">
            <div className="layout-container relative z-10 w-full">
                <div className="grid-12">
                    <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3 text-center flex flex-col items-center">

                        <motion.h1
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-text-primary mb-6 leading-[1.1]"
                        >
                            Autonomous Cloud Operations. Zero Chaos.
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-lg md:text-xl text-text-secondary mb-10 max-w-3xl leading-relaxed"
                        >
                            NexusOPS orchestrates infrastructure decisions through an intelligent
                            Ask → Retrieve → Reason → Act → Verify loop.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center"
                        >
                            <Link href="/deploy" className="inline-flex w-full sm:w-auto items-center justify-center bg-primary hover:bg-primary/90 text-white font-medium px-8 py-3.5 rounded-md transition-colors text-sm">
                                Deploy NexusOPS
                            </Link>
                            <Link href="/architecture" className="inline-flex w-full sm:w-auto items-center justify-center bg-surface hover:bg-surface/80 border border-white/10 text-text-primary font-medium px-8 py-3.5 rounded-md transition-colors text-sm">
                                View Architecture
                            </Link>
                        </motion.div>

                    </div>
                </div>
            </div>
        </section>
    );
}
