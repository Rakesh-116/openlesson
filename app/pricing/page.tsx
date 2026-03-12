"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PLANS, type PlanId } from "@/lib/plans";
import { Footer } from "@/components/Footer";

import { createClient } from "@/lib/supabase/client";
import { DemoBanner } from "@/components/DemoBanner";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
}

// Improved feature descriptions for display (more user-friendly)
const DISPLAY_FEATURES: Record<PlanId, string[]> = {
  free: [
    "1 learning session to try it out",
    "AI listens as you think out loud",
    "Get a report showing your understanding",
  ],
  regular: [
    "5 learning sessions per month",
    "Need more? Add sessions for $1.99 each",
    "Upload recordings for analysis",
    "Customize your tutor's style",
    "Full history and progress tracking",
  ],
  pro: [
    "Unlimited learning sessions",
    "Upload recordings for analysis",
    "Customize your tutor's style",
    "Full history and progress tracking",
    "Priority support",
    "Developer API access",
  ],
};

export default function PricingPage() {
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
            Open source
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            Simple pricing
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto leading-relaxed">
            openLesson is free to use and{" "}
              <a
              href="https://github.com/dncolomer/openLesson"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline underline-offset-2 transition-colors"
            >
              open source on GitHub
            </a>
            . Self-host it or use the hosted version below.
          </p>
        </div>

        {/* Plans — horizontal scroll on mobile, 5-col row on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:px-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:pb-0 mb-6">
          {/* Free */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <p className="text-sm text-slate-400 mb-1">{PLANS.free.name}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">$0</span>
              <span className="text-sm text-slate-600">forever</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1">
              {DISPLAY_FEATURES.free.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("free") ? (
              <div className="mt-auto flex flex-col gap-2">
                <div className="w-full py-2 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                  Current plan
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2 text-center text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? "Loading..." : "Buy extra session — $1.99"}
                </button>
              </div>
            ) : !user?.authenticated ? (
              <Link
                href="/register"
                className="mt-auto w-full py-2 text-center text-sm text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors block"
              >
                Get started
              </Link>
            ) : null}
          </div>

          {/* Regular */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 flex flex-col relative min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-slate-200 text-slate-900 text-[11px] font-medium rounded-full">
              Popular
            </div>
            <p className="text-sm text-slate-400 mb-1">{PLANS.regular.name}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">$4.99</span>
              <span className="text-sm text-slate-600">/mo</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1">
              {DISPLAY_FEATURES.regular.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("regular") ? (
              <div className="mt-auto flex flex-col gap-2">
                <div className="w-full py-2 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                  Current plan
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2 text-center text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? "Loading..." : "Buy extra session — $1.99"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("regular")}
                disabled={loadingPlan === "regular"}
                className="mt-auto w-full py-2 text-center text-sm font-medium text-slate-900 bg-slate-200 hover:bg-white disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "regular" ? "Loading..." : "Subscribe"}
              </button>
            )}
          </div>

          {/* Pro */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <p className="text-sm text-slate-400 mb-1">{PLANS.pro.name}</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">$14.99</span>
              <span className="text-sm text-slate-600">/mo</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1">
              {DISPLAY_FEATURES.pro.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("pro") ? (
              <div className="mt-auto w-full py-2 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                {user?.isAdmin ? "Admin — unlimited" : "Current plan"}
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("pro")}
                disabled={loadingPlan === "pro"}
                className="mt-auto w-full py-2 text-center text-sm text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "pro" ? "Loading..." : "Subscribe"}
              </button>
            )}
          </div>

          {/* $UNSYS Token */}
          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-b from-purple-950/40 to-slate-900/50 p-5 flex flex-col relative min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[11px] font-medium rounded-full whitespace-nowrap">
              Crypto
            </div>
            <p className="text-sm text-purple-400 mb-1">$UNSYS Token</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">Stake</span>
              <span className="text-sm text-slate-600">once</span>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              $UNSYS is the native Solana token behind openLesson. Stake to get permanent plan access
              and earn up to 50% revenue share from every user you refer as a partner.
            </p>

            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400">1M</span>
                <span className="text-slate-300">Regular + 10%</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400">2M</span>
                <span className="text-slate-300">Regular + 30%</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400">5M</span>
                <span className="text-purple-300 font-medium">Pro + 50%</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 font-mono mb-3 truncate">
              CA: Dza3Bey5tvyYiPgcGRKo...pump
            </p>

            <div className="mt-auto flex flex-col gap-2">
              <a
                href="https://pump.fun/coin/Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 text-center text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl transition-colors"
              >
                Buy on pump.fun
              </a>
              <Link
                href="/dashboard/partner"
                className="w-full py-2 text-center text-xs text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-colors"
              >
                Stake &amp; become a partner
              </Link>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-900/30 p-5 flex flex-col min-w-[240px] snap-start shrink-0 xl:min-w-0 xl:shrink">
            <p className="text-sm text-slate-400 mb-1">Enterprise</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">Custom</span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              For teams, schools, and organizations. Custom features, dedicated support, and volume pricing.
            </p>

            <ul className="space-y-2 mb-5 flex-1">
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>Dedicated onboarding</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>Custom topic libraries</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>Analytics &amp; reporting</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-400">
                <CheckIcon />
                <span>Volume pricing</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-500 opacity-60">
                <ClockIcon />
                <span>SSO (coming soon)</span>
              </li>
              <li className="flex items-start gap-2 text-[13px] text-slate-500 opacity-60">
                <ClockIcon />
                <span>LMS (coming soon)</span>
              </li>
            </ul>

            <div className="mt-auto flex flex-col gap-2">
              <a
                href="mailto:daniel@uncertain.systems"
                className="w-full py-2 text-center text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Contact us
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
            All plans include real-time audio analysis and AI-generated session reports.
            Cancel monthly anytime. Staked tokens grant permanent access while staked.
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
