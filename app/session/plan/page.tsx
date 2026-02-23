"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PlanningView } from "@/components/PlanningView";

function PlanningContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-neutral-500 text-sm">No session ID provided.</p>
      </div>
    );
  }

  return <PlanningView sessionId={sessionId} />;
}

export default function PlanningPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <div className="h-screen flex flex-col bg-[#0a0a0a]">
        {/* Header */}
        <header className="border-b border-neutral-800/60 px-4 sm:px-6 py-4 backdrop-blur-sm bg-[#0a0a0a]/80 sticky top-0 z-20">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-base sm:text-lg font-semibold text-white tracking-tight hover:text-neutral-300 transition-colors">
              Socratic Lesson
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/pricing" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/coaching" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
                Coaching
              </Link>
              <Link href="/dashboard" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link href="/plans" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
                Plans
              </Link>
            </div>
          </div>
        </header>
        <PlanningContent />
      </div>
    </Suspense>
  );
}
