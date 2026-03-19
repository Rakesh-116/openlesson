"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PLANS, type PlanId } from "@/lib/plans";
import { Footer } from "@/components/Footer";

import { createClient } from "@/lib/supabase/client";
import { DemoBanner } from "@/components/DemoBanner";
import { useI18n } from "@/lib/i18n";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

export default function PricingPage() {
  const { t } = useI18n();
  const [user, setUser] = useState<UserState | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setUser({ authenticated: false, plan: "free", isAdmin: false });
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, is_admin")
          .eq("id", authUser.id)
          .single();

        setUser({
          authenticated: true,
          plan: (profile?.plan || "free") as PlanId,
          isAdmin: profile?.is_admin ?? false,
        });
      } catch {
        setUser({ authenticated: false, plan: "free", isAdmin: false });
      }
    };
    load();
  }, []);

  const handleCheckout = async (priceType: "regular" | "pro" | "extra_lesson") => {
    if (!user?.authenticated) {
      window.location.href = "/login?redirect=/pricing";
      return;
    }
    setLoadingPlan(priceType);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert("Failed to create checkout: " + data.error);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to create checkout session. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const isCurrentPlan = (planId: PlanId) =>
    user?.authenticated && user.plan === planId;

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Open Source Banner */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {t('pricing.openSource')}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            {t('pricing.title')}
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto leading-relaxed">
            {t('pricing.subtitlePart1')}{" "}
              <a
              href="https://github.com/dncolomer/openLesson"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline underline-offset-2 transition-colors"
            >
              {t('pricing.githubLinkText')}
            </a>
            . {t('pricing.subtitlePart2')}
          </p>
        </div>

        {/* Plans — horizontal scroll on mobile, 5-col row on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:px-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:pb-0 mb-6">
          {/* Free */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <p className="text-sm text-slate-400 mb-1">{t('pricing.free')}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">$0</span>
              <span className="text-sm text-slate-600">{t('pricing.forever')}</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1">
              {[
                t('pricing.feature1Session'),
                t('pricing.featureAiListens'),
                t('pricing.featureReport'),
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("free") ? (
              <div className="mt-auto flex flex-col gap-2">
                <div className="w-full py-2 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                  {t('pricing.currentPlan')}
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2 text-center text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? t('common.loading') : t('pricing.buyExtraSession')}
                </button>
              </div>
            ) : !user?.authenticated ? (
              <Link
                href="/register"
                className="mt-auto w-full py-2 text-center text-sm text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors block"
              >
                {t('pricing.getStarted')}
              </Link>
            ) : null}
          </div>

          {/* Regular */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 flex flex-col relative min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-slate-200 text-slate-900 text-[11px] font-medium rounded-full">
              {t('pricing.popular')}
            </div>
            <p className="text-sm text-slate-400 mb-1">{t('pricing.regular')}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">$4.99</span>
              <span className="text-sm text-slate-600">/mo</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1">
              {[
                t('pricing.feature5Sessions'),
                t('pricing.featureExtra199'),
                t('pricing.featureUpload'),
                t('pricing.featureCustomize'),
                t('pricing.featureHistory'),
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("regular") ? (
              <div className="mt-auto flex flex-col gap-2">
                <div className="w-full py-2 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                  {t('pricing.currentPlan')}
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2 text-center text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? t('common.loading') : t('pricing.buyExtraSession')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("regular")}
                disabled={loadingPlan === "regular"}
                className="mt-auto w-full py-2 text-center text-sm font-medium text-slate-900 bg-slate-200 hover:bg-white disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "regular" ? t('common.loading') : t('pricing.subscribe')}
              </button>
            )}
          </div>

          {/* Pro */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <p className="text-sm text-slate-400 mb-1">{t('pricing.pro')}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">$14.99</span>
              <span className="text-sm text-slate-600">/mo</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1">
              {[
                t('pricing.featureUnlimited'),
                t('pricing.featureUpload'),
                t('pricing.featureCustomize'),
                t('pricing.featureHistory'),
                t('pricing.featurePrioritySupport'),
                t('pricing.featureApiAccess'),
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("pro") ? (
              <div className="mt-auto w-full py-2 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                {user?.isAdmin ? t('pricing.adminUnlimited') : t('pricing.currentPlan')}
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("pro")}
                disabled={loadingPlan === "pro"}
                className="mt-auto w-full py-2 text-center text-sm text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "pro" ? t('common.loading') : t('pricing.subscribe')}
              </button>
            )}
          </div>

          {/* $UNSYS Token */}
          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-b from-purple-950/40 to-slate-900/50 p-5 flex flex-col relative min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[11px] font-medium rounded-full whitespace-nowrap">
              {t('pricing.crypto')}
            </div>
            <p className="text-sm text-purple-400 mb-1">{t('pricing.unstakeToken')}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">{t('pricing.stake')}</span>
              <span className="text-sm text-slate-600">{t('pricing.once')}</span>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              {t('pricing.tokenDescription')}
            </p>

            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400">{t('pricing.token1M')}</span>
                <span className="text-slate-300">{t('pricing.tierBenefitRegular10')}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400">{t('pricing.token2M')}</span>
                <span className="text-slate-300">{t('pricing.tierBenefitRegular30')}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400">{t('pricing.token5M')}</span>
                <span className="text-purple-300 font-medium">{t('pricing.tierBenefitPro50')}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 font-mono mb-3 truncate">
              {t('pricing.tokenContract')}
            </p>

            <div className="mt-auto flex flex-col gap-2">
              <a
                href="https://pump.fun/coin/Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 text-center text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl transition-colors"
              >
                {t('pricing.buyOnPumpFun')}
              </a>
              <Link
                href="/dashboard/partner"
                className="w-full py-2 text-center text-xs text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-colors"
              >
                {t('pricing.stakeBecomePartner')}
              </Link>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-900/30 p-5 flex flex-col min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <p className="text-sm text-slate-400 mb-1">{t('pricing.enterprise')}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">{t('pricing.custom')}</span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {t('pricing.enterpriseDesc')}
            </p>

            <ul className="space-y-2 mb-5 flex-1">
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>{t('pricing.dedicatedOnboarding')}</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>{t('pricing.customTopicLibraries')}</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>{t('pricing.analyticsReporting')}</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>{t('pricing.volumePricing')}</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-500 opacity-60">
                <ClockIcon />
                <span>{t('pricing.ssoComingSoon')}</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-500 opacity-60">
                <ClockIcon />
                <span>{t('pricing.lmsComingSoon')}</span>
              </li>
            </ul>

            <div className="mt-auto flex flex-col gap-2">
              <a
                href="mailto:daniel@uncertain.systems"
                className="w-full py-2 text-center text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                {t('pricing.contactUs')}
              </a>
              <a
                href="https://x.com/uncertainsys"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 text-center text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-xl transition-colors"
              >
                @uncertainsys
              </a>
            </div>
          </div>
        </div>

        {/* All plans include */}
        <div className="text-center text-xs text-slate-600 mb-12">
          <p>
            {t('pricing.allPlansInclude')}
          </p>
        </div>


      </div>
      <Footer />
    </main>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
