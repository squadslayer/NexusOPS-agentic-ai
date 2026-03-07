import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: {
        template: "%s | NexusOps",
        default: "NexusOps — Agentic Cloud Governance",
    },
    description: "Enterprise cloud governance and resource management control plane.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="bg-background text-textMain antialiased">
                {children}
            </body>
        </html>
    );
}
