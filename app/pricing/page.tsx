"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PLANS, type PlanId } from "@/lib/plans";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";

interface UserState {
  authenticated: boolean;
  plan: PlanId;
  isAdmin: boolean;
  walletVerified: boolean;
  tokenTier: string | null;
}

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
          setUser({ authenticated: false, plan: "free", isAdmin: false, walletVerified: false, tokenTier: null });
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, is_admin, wallet_address, token_tier")
          .eq("id", authUser.id)
          .single();

        setUser({
          authenticated: true,
          plan: (profile?.plan || "free") as PlanId,
          isAdmin: profile?.is_admin ?? false,
          walletVerified: !!profile?.wallet_address,
          tokenTier: profile?.token_tier ?? null,
        });
      } catch {
        setUser({ authenticated: false, plan: "free", isAdmin: false, walletVerified: false, tokenTier: null });
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
      setUser((prev) => prev ? { ...prev, walletVerified: true, tokenTier: data.tier } : null);
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
          <p className="text-neutral-500 text-base max-w-lg mx-auto leading-relaxed">
            openLesson is free to use and{" "}
              <a
              href="https://github.com/dncolomer/openLesson"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-300 hover:text-white underline underline-offset-2 transition-colors"
            >
              open source on GitHub
            </a>
            . Self-host it or use the hosted version below.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
            <button
              onClick={() => setViewMode("regular")}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === "regular" 
                  ? "bg-white text-black font-medium" 
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("lifetime")}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === "lifetime" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium" 
                  : "text-neutral-400 hover:text-white"
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
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 flex flex-col">
            <p className="text-sm text-neutral-400 mb-1">{PLANS.free.name}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$0</span>
              <span className="text-sm text-neutral-600">forever</span>
            </div>
            <ul className="space-y-2.5 mb-6 flex-1">
              {PLANS.free.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-neutral-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("free") ? (
              <div className="flex flex-col gap-2">
                <div className="w-full py-2.5 text-center text-xs text-neutral-600 border border-neutral-800 rounded-xl">
                  Current plan
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2.5 text-center text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? "Loading..." : "Buy extra session — $1.99"}
                </button>
              </div>
            ) : !user?.authenticated ? (
              <Link
                href="/register"
                className="w-full py-2.5 text-center text-sm text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors block"
              >
                Get started
              </Link>
            ) : null}
          </div>

          {/* Regular */}
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/80 p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-white text-black text-[11px] font-medium rounded-full">
              Popular
            </div>
            <p className="text-sm text-neutral-400 mb-1">{PLANS.regular.name}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$4.99</span>
              <span className="text-sm text-neutral-600">/month</span>
            </div>
            <ul className="space-y-2.5 mb-6 flex-1">
              {PLANS.regular.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-neutral-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("regular") ? (
              <div className="flex flex-col gap-2">
                <div className="w-full py-2.5 text-center text-xs text-neutral-600 border border-neutral-800 rounded-xl">
                  Current plan
                </div>
                <button
                  onClick={() => handleCheckout("extra_lesson")}
                  disabled={loadingPlan === "extra_lesson"}
                  className="w-full py-2.5 text-center text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-xl transition-colors"
                >
                  {loadingPlan === "extra_lesson" ? "Loading..." : "Buy extra session — $1.99"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("regular")}
                disabled={loadingPlan === "regular"}
                className="w-full py-2.5 text-center text-sm font-medium text-black bg-white hover:bg-neutral-200 disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "regular" ? "Loading..." : "Subscribe"}
              </button>
            )}
          </div>

          {/* Pro */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 flex flex-col">
            <p className="text-sm text-neutral-400 mb-1">{PLANS.pro.name}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$14.99</span>
              <span className="text-sm text-neutral-600">/month</span>
            </div>
            <ul className="space-y-2.5 mb-6 flex-1">
              {PLANS.pro.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-neutral-400">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrentPlan("pro") ? (
              <div className="w-full py-2.5 text-center text-xs text-neutral-600 border border-neutral-800 rounded-xl">
                {user?.isAdmin ? "Admin — unlimited" : "Current plan"}
              </div>
            ) : (
              <button
                onClick={() => handleCheckout("pro")}
                disabled={loadingPlan === "pro"}
                className="w-full py-2.5 text-center text-sm text-white bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingPlan === "pro" ? "Loading..." : "Subscribe"}
              </button>
            )}
          </div>
          </div>
          </>
        ) : (
          <>
            {/* Lifetime Token Access */}
            <div className="max-w-2xl mx-auto mb-12">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-blue-400 text-xs mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Lifetime Access
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Hold $UNSYS Tokens</h2>
                  <p className="text-neutral-400 text-sm">
                    Get lifetime access to openLesson by holding $UNSYS tokens in your Solana wallet.
                    You don't need to send us anything — just prove you own the tokens.
                  </p>
                </div>

                <div className="bg-neutral-950 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-medium text-white mb-3">Token Tier Mapping</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Any $UNSYS balance</span>
                      <span className="text-sm font-medium text-blue-400">Regular Tier</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">5M+ $UNSYS</span>
                      <span className="text-sm font-medium text-purple-400">Pro Tier</span>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-950 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-medium text-white mb-2">How it works</h3>
                  <ol className="space-y-2 text-sm text-neutral-400">
                    <li className="flex gap-2">
                      <span className="text-neutral-600">1.</span>
                      Enter your Solana wallet address above
                    </li>
                    <li className="flex gap-2">
                      <span className="text-neutral-600">2.</span>
                      We verify your token balance on-chain
                    </li>
                    <li className="flex gap-2">
                      <span className="text-neutral-600">3.</span>
                      Your account is upgraded — tokens stay in your wallet!
                    </li>
                  </ol>
                </div>

                {user?.walletVerified && user.tokenTier ? (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-neutral-950 rounded-xl px-4 py-3">
                      <span className="text-sm text-neutral-400">Verified</span>
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
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
                    />
                    {walletError && (
                      <p className="text-xs text-red-400 text-center">{walletError}</p>
                    )}
                    <button
                      type="button"
                      disabled={true}
                      className="w-full py-3 text-sm font-medium text-neutral-500 bg-neutral-800 rounded-lg cursor-not-allowed"
                    >
                      Verify Token Ownership (Coming Soon)
                    </button>
                    <p className="text-xs text-neutral-700 text-center">
                      We only check your balance — tokens never leave your wallet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* FAQ / Extra info */}
        {viewMode === "regular" && (
          <div className="text-center text-xs text-neutral-700">
            <p>
              All plans include real-time audio analysis and AI-generated session reports.
              Cancel anytime from your Stripe dashboard.
            </p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
