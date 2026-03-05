"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Command, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
    { name: "Architecture", href: "/architecture" },
    { name: "Features", href: "/features" },
    { name: "Security", href: "/security" },
    { name: "Deploy", href: "/deploy" },
];

export function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${isScrolled ? "bg-background border-b border-white/5" : "bg-transparent"
                }`}
        >
            <div className="layout-container h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2" aria-label="NexusOPS Home">
                    <Command className="w-5 h-5 text-primary" />
                    <span className="text-text-primary font-bold tracking-tight">
                        NexusOPS
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                <div className="hidden md:flex items-center gap-4">
                    <Link href="http://localhost:3001/login" className="inline-block bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
                        Deploy NexusOPS
                    </Link>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    aria-label="Toggle mobile menu"
                    className="md:hidden text-text-secondary hover:text-text-primary"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    {isMobileMenuOpen ? (
                        <X className="w-6 h-6" />
                    ) : (
                        <Menu className="w-6 h-6" />
                    )}
                </button>
            </div>

            {/* Mobile Navigation */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="md:hidden bg-surface border-b border-white/5 overflow-hidden"
                    >
                        <div className="layout-container py-4 flex flex-col gap-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors block py-2"
                                >
                                    {link.name}
                                </Link>
                            ))}
                            <Link href="http://localhost:3001/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center inline-block bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors mt-2">
                                Deploy NexusOPS
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
}
