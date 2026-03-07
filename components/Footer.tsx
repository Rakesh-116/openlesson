"use client";

import Link from "next/link";

const productLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "1-on-1 Coaching", href: "/coaching" },
];

const solutionLinks = [
  { label: "AI Sales Training", href: "/enterprise" },
  { label: "AI Hiring Assessments", href: "/eval" },
  { label: "AI Classroom Tutor", href: "/schools" },
  { label: "AI Homeschool Tutor", href: "/homeschool" },
  { label: "AI Certification Prep", href: "/certify" },
];

const companyLinks = [
  { label: "About", href: "/about" },
];

const legalLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
  { label: "Legal Notice", href: "/legal" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-800/40 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Multi-column links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800/40">
          {/* Product */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Solutions
            </h3>
            <ul className="space-y-3">
              {solutionLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/dncolomer/openlesson"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-500 hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social links */}
        <div className="flex flex-wrap items-center justify-center gap-3 py-6">
          <a
            href="https://x.com/uncertainsys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-800 text-slate-400 text-xs font-medium hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            @uncertainsys
          </a>
          <a
            href="mailto:daniel@uncertain.systems"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-800 text-slate-400 text-xs font-medium hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            daniel@uncertain.systems
          </a>
          <a
            href="https://github.com/dncolomer/openlesson"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-800 text-slate-400 text-xs font-medium hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
        </div>

        {/* Copyright + tagline */}
        <div className="text-center pt-3">
          <p className="text-[11px] text-slate-600 mb-1">
            &copy; {currentYear} Uncertain Systems (Daniel Colomer). All rights reserved.
          </p>
          <p className="text-[11px] text-slate-700 tracking-widest uppercase">
            Building the open stack for educational technology
          </p>
        </div>
      </div>
    </footer>
  );
}
