"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Architecture", path: "/architecture" },
    { label: "Features", path: "/features" },
    { label: "Security", path: "/security" },
    { label: "Deploy", path: "/deploy" },
  ];

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link href="/" className="nav-brand">
          <ShieldAlert className="text-brand-primary" size={28} color="#3b82f6" />
          <span>NexusOps</span>
        </Link>
        <div className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-link ${pathname === item.path ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/use" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
