"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSession, getSessionPlan } from "@/lib/storage";
import { MobileSessionView } from "@/components/MobileSessionView";
import type { Session, SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

export default function MobileSessionPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check auth
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push(`/login?redirect=/session/mobile/${sessionId}`);
          return;
        }

        // Load session and plan
        const [sessionData, planData] = await Promise.all([
          getSession(sessionId),
          getSessionPlan(sessionId),
        ]);

        if (!sessionData) {
          setError(t('session.sessionNotFound'));
          setLoading(false);
          return;
        }

        setSession(sessionData);
        setPlan(planData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load session:", err);
        setError(t('session.loadError'));
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">{t('session.loadingSession')}</p>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">
          {error || t('session.sessionNotFound')}
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          {t('session.sessionNotFoundDesc')}
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white hover:bg-neutral-700 transition-colors"
        >
          {t('session.goToDashboard')}
        </button>
      </div>
    );
  }

  return (
    <MobileSessionView
      sessionId={sessionId}
      initialSession={session}
      initialPlan={plan}
    />
  );
}
