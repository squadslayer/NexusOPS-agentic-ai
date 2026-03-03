import Link from "next/link";
import { ShieldAlert, Github, Twitter, Linkedin } from "lucide-react";

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-content">
                    <div className="footer-brand">
                        <Link href="/" className="nav-brand">
                            <ShieldAlert color="#3b82f6" size={24} />
                            <span>NexusOps</span>
                        </Link>
                        <p>
                            AWS-native agentic AI engineering assistant built for security, compliance, and Free Tier alignment.
                        </p>
                    </div>

                    <div className="footer-links-group">
                        <h4>Product</h4>
                        <ul>
                            <li><Link href="/architecture">Architecture</Link></li>
                            <li><Link href="/features">Features</Link></li>
                            <li><Link href="/security">Security</Link></li>
                            <li><Link href="/deploy">Deploy</Link></li>
                        </ul>
                    </div>

                    <div className="footer-links-group">
                        <h4>Resources</h4>
                        <ul>
                            <li><Link href="#">Documentation</Link></li>
                            <li><Link href="#">API Reference</Link></li>
                            <li><Link href="#">Compliance Guide</Link></li>
                        </ul>
                    </div>

                    <div className="footer-links-group">
                        <h4>Connect</h4>
                        <ul style={{ flexDirection: "row", gap: "1rem" }}>
                            <li>
                                <a href="#" aria-label="GitHub">
                                    <Github size={20} />
                                </a>
                            </li>
                            <li>
                                <a href="#" aria-label="Twitter">
                                    <Twitter size={20} />
                                </a>
                            </li>
                            <li>
                                <a href="#" aria-label="LinkedIn">
                                    <Linkedin size={20} />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} NexusOps. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
