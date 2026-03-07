"use client";

import Link from "next/link";

const DEMO_URL = "https://cal.com/daniel-colomer-lvwg8w/openlesson-demo?overlayCalendar=true";

export function DemoBanner() {
  return (
    <div className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-2 text-sm">
        <span className="text-slate-300">Want to see openLesson in action?</span>
        <Link
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-medium underline underline-offset-2 hover:text-slate-200 transition-colors"
        >
          Schedule a demo
        </Link>
      </div>
    </div>
  );
}
