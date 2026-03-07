"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PLANS, type PlanId } from "@/lib/plans";
import { Footer } from "@/components/Footer";
import { FAQ, PRICING_FAQ_ITEMS } from "@/components/FAQ";
import { createClient } from "@/lib/supabase/client";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
  walletVerified: boolean;
  tokenTier: string | null;
  tokenValidityExpiresAt: string | null;
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
  const [viewMode, setViewMode] = useState<"regular" | "lifetime">("regular");
  
  // Wallet verification state
  const [walletAddress, setWalletAddress] = useState("");
  const [verifyingWallet, setVerifyingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setUser({ authenticated: false, plan: "free", isAdmin: false, walletVerified: false, tokenTier: null, tokenValidityExpiresAt: null });
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, is_admin, wallet_address, token_tier, token_validity_expires_at")
          .eq("id", authUser.id)
          .single();

        setUser({
          authenticated: true,
          plan: (profile?.plan || "free") as PlanId,
          isAdmin: profile?.is_admin ?? false,
          walletVerified: !!profile?.wallet_address,
          tokenTier: profile?.token_tier ?? null,
          tokenValidityExpiresAt: profile?.token_validity_expires_at ?? null,
        });
      } catch {
        setUser({ authenticated: false, plan: "free", isAdmin: false, walletVerified: false, tokenTier: null, tokenValidityExpiresAt: null });
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

  const handleVerifyWallet = async () => {
    console.log("Verify wallet clicked, user:", user, "address:", walletAddress);
    if (!user?.authenticated) {
      window.location.href = "/login?redirect=/pricing";
      return;
    }
    if (!walletAddress.trim()) {
      setWalletError("Please enter a wallet address");
      return;
    }
    setVerifyingWallet(true);
    setWalletError(null);
    try {
      const trimmedAddress = walletAddress.trim();
      console.log("Calling API with address:", trimmedAddress);
      const res = await fetch("/api/verify-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: trimmedAddress }),
      });
      const data = await res.json();
      console.log("API response:", res.status, data);
      if (!res.ok) {
        setWalletError(data.error || "Verification failed");
        return;
      }
      if (data.tier === null) {
        setWalletError("No $UNSYS tokens found in this wallet");
        return;
      }
      setUser((prev) => prev ? { ...prev, walletVerified: true, tokenTier: data.tier, tokenValidityExpiresAt: data.expiresAt } : null);
    } catch (err) {
      console.error("Verify error:", err);
      setWalletError("Failed to verify wallet");
    } finally {
      setVerifyingWallet(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
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

        {/* Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setViewMode("regular")}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === "regular" 
                  ? "bg-slate-200 text-slate-900 font-medium" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("lifetime")}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === "lifetime" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Lifetime (Token)
            </button>
          </div>
        </div>

        {viewMode === "regular" ? (
          <>
            {/* Regular Monthly Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {/* Free */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col">
            <p className="text-sm text-slate-400 mb-1">{PLANS.free.name}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$0</span>
              <span className="text-sm text-slate-600">forever</span>
            </div>
            <ul className="space-y-2.5 mb-6 flex-1">
              {DISPLAY_FEATURES.free.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("free") ? (
              <div className="flex flex-col gap-2">
                <div className="w-full py-2.5 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                  Current plan
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2.5 text-center text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? "Loading..." : "Buy extra session — $1.99"}
                </button>
              </div>
            ) : !user?.authenticated ? (
              <Link
                href="/register"
                className="w-full py-2.5 text-center text-sm text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors block"
              >
                Get started
              </Link>
            ) : null}
          </div>

          {/* Regular */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-slate-200 text-slate-900 text-[11px] font-medium rounded-full">
              Popular
            </div>
            <p className="text-sm text-slate-400 mb-1">{PLANS.regular.name}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$4.99</span>
              <span className="text-sm text-slate-600">/month</span>
            </div>
            <ul className="space-y-2.5 mb-6 flex-1">
              {DISPLAY_FEATURES.regular.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("regular") ? (
              <div className="flex flex-col gap-2">
                <div className="w-full py-2.5 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                  Current plan
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2.5 text-center text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? "Loading..." : "Buy extra session — $1.99"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("regular")}
                disabled={loadingPlan === "regular"}
                className="w-full py-2.5 text-center text-sm font-medium text-slate-900 bg-slate-200 hover:bg-white disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "regular" ? "Loading..." : "Subscribe"}
              </button>
            )}
          </div>

          {/* Pro */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col">
            <p className="text-sm text-slate-400 mb-1">{PLANS.pro.name}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$14.99</span>
              <span className="text-sm text-slate-600">/month</span>
            </div>
            <ul className="space-y-2.5 mb-6 flex-1">
              {DISPLAY_FEATURES.pro.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("pro") ? (
              <div className="w-full py-2.5 text-center text-xs text-slate-600 border border-slate-800 rounded-xl">
                {user?.isAdmin ? "Admin — unlimited" : "Current plan"}
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("pro")}
                disabled={loadingPlan === "pro"}
                className="w-full py-2.5 text-center text-sm text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "pro" ? "Loading..." : "Subscribe"}
              </button>
            )}
          </div>
          </div>

          {/* All plans include */}
          <div className="text-center text-xs text-slate-600 mb-12">
            <p>
              All plans include real-time audio analysis and AI-generated session reports.
              Cancel anytime from your Stripe dashboard.
            </p>
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <FAQ items={PRICING_FAQ_ITEMS} />
          </div>
          </>
        ) : (
          <>
            {/* Lifetime Token Access */}
            <div className="max-w-2xl mx-auto mb-12">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-blue-400 text-xs mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Lifetime Access
                  </div>
                  <div className="flex justify-center mb-4">
                    <img 
                      src="https://images.pump.fun/coin-image/Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump?variant=600x600&ipfs=bafybeigjzyjou2spcdbaknnxjzp2gxqdof4ezyedxxajr2wpxwbbgqmj5a&src=https%3A%2F%2Fipfs.io%2Fipfs%2Fbafybeigjzyjou2spcdbaknnxjzp2gxqdof4ezyedxxajr2wpxwbbgqmj5a" 
                      alt="$UNSYS Token" 
                      className="w-16 h-16 rounded-full"
                    />
                  </div>
                  <p className="text-xs text-slate-500 font-mono mb-2">
                    CA: Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump
                  </p>
                  <a
                    href="https://pump.fun/coin/Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg transition-colors mb-4"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    Buy $UNSYS on pump.fun
                  </a>
                  <h2 className="text-2xl font-bold text-white mb-2">Hold $UNSYS Tokens</h2>
                  <p className="text-slate-400 text-sm">
                    Get lifetime access to openLesson by holding $UNSYS tokens in your Solana wallet.
                    You don't need to send us anything — just prove you own the tokens. Validated holdings
                    must be reconfirmed every 3 months to maintain access.
                  </p>
                </div>

                <div className="bg-slate-950 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-medium text-white mb-3">Token Tier Mapping</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">2M+ $UNSYS</span>
                      <span className="text-sm font-medium text-blue-400">Regular Tier</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">5M+ $UNSYS</span>
                      <span className="text-sm font-medium text-purple-400">Pro Tier</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-medium text-white mb-2">How it works</h3>
                  <ol className="space-y-2 text-sm text-slate-400">
                    <li className="flex gap-2">
                      <span className="text-slate-600">1.</span>
                      Enter your Solana wallet address below
                    </li>
                    <li className="flex gap-2">
                      <span className="text-slate-600">2.</span>
                      We verify your token balance on-chain
                    </li>
                    <li className="flex gap-2">
                      <span className="text-slate-600">3.</span>
                      Your account is upgraded — tokens stay in your wallet!
                    </li>
                    <li className="flex gap-2">
                      <span className="text-slate-600">4.</span>
                      Re-verify every 3 months to maintain access
                    </li>
                  </ol>
                </div>

                {user?.walletVerified && user.tokenTier ? (
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center gap-3 bg-slate-950 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-400">Verified</span>
                        <span
                          className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium ${
                            user.tokenTier === "pro"
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {user.tokenTier === "pro" ? "Pro" : "Regular"} Tier
                        </span>
                      </div>
                      {user.tokenValidityExpiresAt && (
                        <span className="text-xs text-slate-500">
                          Valid until {new Date(user.tokenValidityExpiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      name="walletAddress"
                      id="walletAddress"
                      placeholder="Enter your Solana wallet address"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-slate-600 placeholder:text-slate-600"
                    />
                    {walletError && (
                      <p className="text-xs text-red-400 text-center">{walletError}</p>
                    )}
                    <button
                      type="button"
                      disabled={true}
                      className="w-full py-3 text-sm font-medium text-slate-500 bg-slate-800 rounded-lg cursor-not-allowed"
                    >
                      Verify Token Ownership (Coming Soon)
                    </button>
                    <p className="text-xs text-slate-700 text-center">
                      We only check your balance — tokens never leave your wallet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Enterprise Section */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-900/30 p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Enterprise & Education
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Need a custom solution?
              </h2>
              <p className="text-slate-400 text-sm max-w-lg mx-auto mb-6">
                For teams, schools, and organizations. We're building dedicated features for enterprise use cases.
              </p>
            </div>
            
            {/* Enterprise Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="flex items-start gap-2">
                <CheckIcon />
                <span className="text-sm text-slate-400">Dedicated onboarding & support</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon />
                <span className="text-sm text-slate-400">Custom topic libraries</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon />
                <span className="text-sm text-slate-400">Usage analytics & reporting</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon />
                <span className="text-sm text-slate-400">Volume pricing</span>
              </div>
              <div className="flex items-start gap-2 opacity-60">
                <ClockIcon />
                <span className="text-sm text-slate-500">SSO integration (coming soon)</span>
              </div>
              <div className="flex items-start gap-2 opacity-60">
                <ClockIcon />
                <span className="text-sm text-slate-500">LMS integration (coming soon)</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://x.com/uncertainsys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                @uncertainsys
              </a>
              <a
                href="mailto:daniel@uncertain.systems"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                daniel@uncertain.systems
              </a>
            </div>
          </div>
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
