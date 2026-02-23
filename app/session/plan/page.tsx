"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PlanningView } from "@/components/PlanningView";
import { Navbar } from "@/components/Navbar";

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
        <Navbar />
        <PlanningContent />
      </div>
    </Suspense>
  );
}
