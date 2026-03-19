"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { PARTNER_TIERS, UNSTAKE_LOCKUP_DAYS, PartnerTier } from "@/lib/partners";
import { Copy, ExternalLink, DollarSign, Users, Link2, AlertTriangle, Check, X, Wallet, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect?: () => Promise<void>;
    };
  }
}

interface PartnerData {
  isPartner: boolean;
  partner?: {
    id: string;
    tier: PartnerTier;
    stakeAmount: number;
    referralCode: string;
    stripeAccountId: string | null;
    stripeAccountStatus: string;
    totalRevenueClaimed: number;
    lastPayoutAt: string | null;
    unstakeRequestedAt: string | null;
    createdAt: string;
  };
  stats?: {
    referralCount: number;
    unclaimedRevenue: number;
    lifetimeEarnings: number;
    isUnstakeLocked: boolean;
    unlockDate: string | null;
  };
  referredUsers?: { user_id: string; username: string; created_at: string }[];
}

export default function PartnerPage() {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [showUnstakeConfirm, setShowUnstakeConfirm] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Staking flow
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PartnerTier | null>(null);
  const [staking, setStaking] = useState(false);
  const [stakeStep, setStakeStep] = useState<"select" | "verify" | "done">("select");
  const [error, setError] = useState<string | null>(null);

  const STAKING_WALLET = "3Q6HtL8pmenFZjN4TQ21okC12WWKBeeH9k5g3pYT4WYY";

  const connectWallet = async () => {
    // Try to connect to Phantom or other Solana wallet
    if (window.solana?.isPhantom) {
      try {
        const response = await window.solana.connect();
        setWalletAddress(response.publicKey.toString());
        setWalletConnected(true);
      } catch (err) {
        console.error("Failed to connect wallet:", err);
        setError("Failed to connect wallet");
      }
    } else {
      // Show manual input if no wallet found
      setError("No wallet found. Please install Phantom or enter your wallet address manually.");
    }
  };

  const handleStake = async () => {
    if (!selectedTier || !walletAddress) return;
    
    setStaking(true);
    setError(null);

    try {
      const res = await fetch("/api/partners/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stakeAmount: PARTNER_TIERS[selectedTier].stakeAmount,
          walletAddress: walletAddress,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStakeStep("done");
        loadPartnerData();
      } else {
        setError(data.error || "Failed to become partner");
      }
    } catch (err) {
      setError("An error occurred");
    } finally {
      setStaking(false);
    }
  };

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/partners/me");
      const data = await res.json();
      setPartnerData(data);
    } catch (error) {
      console.error("Error loading partner data:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (!partnerData?.partner) return;
    const link = `${window.location.origin}/register?ref=${partnerData.partner.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connectStripe = async () => {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/partners/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
    } finally {
      setConnectingStripe(false);
    }
  };

  const requestUnstake = async () => {
    setUnstaking(true);
    try {
      const res = await fetch("/api/partners/unstake", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        loadPartnerData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error requesting unstake:", error);
    } finally {
      setUnstaking(false);
      setShowUnstakeConfirm(false);
    }
  };

  const confirmUnstake = async () => {
    setUnstaking(true);
    try {
      const res = await fetch("/api/partners/confirm-unstake", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        router.push("/dashboard");
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error confirming unstake:", error);
    } finally {
      setUnstaking(false);
      setShowUnstakeConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!partnerData?.isPartner) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold text-white mb-4">{t('partner.program') || 'Partner Program'}</h1>
          <p className="text-neutral-400 mb-8">{t('partner.becomePartner') || "Become an openLesson partner and earn revenue from your referrals."}</p>
          
          {stakeStep === "done" ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('partner.nowPartner') || "You're now a partner!"}</h2>
              <p className="text-neutral-400 mb-2">{t('partner.accountCreated') || "Your partner account has been created."}</p>
              <p className="text-sm text-emerald-400 mb-6">{t('partner.planUpgraded') || "Your plan has been automatically upgraded based on your stake tier."}</p>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
              >
                Go to Dashboard
              </button>
            </div>
          ) : stakeStep === "verify" ? (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Confirm Stake</h2>
              
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Action Required</span>
                </div>
                <p className="text-sm text-neutral-300">
                  Send exactly <strong>{(PARTNER_TIERS[selectedTier!].stakeAmount / 1_000_000)}M $UNSYS</strong> tokens to:
                </p>
                <code className="block mt-3 p-3 bg-neutral-800 rounded-lg text-emerald-400 text-sm break-all">
                  {STAKING_WALLET}
                </code>
                <p className="text-xs text-neutral-500 mt-3">
                  Staking is currently a manual token transfer. Smart contract staking coming soon.
                  Your plan will be automatically upgraded once the transfer is verified.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStakeStep("select")}
                  className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
                >
                  Back
                </button>
                <button
                  onClick={handleStake}
                  disabled={staking}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {staking ? "Processing..." : "I've Sent the Tokens"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <p className="mt-4 text-red-400 text-sm">{error}</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {(["bronze", "silver", "gold"] as PartnerTier[]).map((tier) => {
                  const info = PARTNER_TIERS[tier];
                  const isSelected = selectedTier === tier;
                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={`border rounded-xl p-6 text-left transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30"
                          : tier === "gold"
                          ? "border-amber-500 bg-amber-500/10 hover:border-amber-400"
                          : tier === "silver"
                          ? "border-slate-400 bg-slate-400/10 hover:border-slate-300"
                          : "border-amber-700 bg-amber-700/10 hover:border-amber-600"
                      }`}
                    >
                      <div className="text-lg font-semibold text-white mb-2 capitalize">{tier}</div>
                      <div className="text-2xl font-bold text-white mb-4">{(info.stakeAmount / 1_000_000)}M $UNSYS</div>
                      <div className="text-sm text-neutral-400">
                        Earn <span className="text-emerald-400">{info.revenueShare * 100}%</span> revenue share
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <h3 className="font-semibold text-white mb-4">Connect Your Wallet</h3>
                
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={connectWallet}
                    className="flex-1 px-4 py-3 bg-[#635BFF] text-white rounded-lg hover:bg-[#5851E1] flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Phantom
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-neutral-900 px-2 text-neutral-500">Or enter manually</span>
                  </div>
                </div>

                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => {
                    setWalletAddress(e.target.value);
                    setWalletConnected(!!e.target.value);
                  }}
                  placeholder="Your Solana wallet address"
                  className="w-full mt-4 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500"
                />

                {error && (
                  <p className="mt-4 text-red-400 text-sm">{error}</p>
                )}

                <button
                  onClick={() => {
                    if (!selectedTier) {
                      setError("Please select a tier first");
                      return;
                    }
                    if (!walletAddress) {
                      setError("Please connect or enter your wallet address");
                      return;
                    }
                    setStakeStep("verify");
                    setError(null);
                  }}
                  disabled={!selectedTier || !walletAddress}
                  className="w-full mt-6 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue to Stake
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-8 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <h3 className="font-semibold text-white mb-2">{t('partner.howItWorks') || 'How it works'}</h3>
                <ol className="text-sm text-neutral-400 space-y-1 list-decimal list-inside">
                  <li>{t('partner.step1') || 'Select a tier and connect your wallet'}</li>
                  <li>{t('partner.step2') || 'Send $UNSYS tokens to the staking address'}</li>
                  <li>{t('partner.step3') || 'Get a unique invite link to share with others'}</li>
                  <li>{t('partner.step4') || 'Earn revenue when your referred users subscribe'}</li>
                  <li>{t('partner.step5') || 'Connect your Stripe account to receive payouts'}</li>
                  <li>{t('partner.step6') || 'Request unstake anytime (60-day lockup applies)'}</li>
                </ol>
              </div>
            </>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 px-6 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { partner, stats } = partnerData;
  if (!partner || !stats) return null;

  const tierInfo = PARTNER_TIERS[partner.tier];
  const inviteLink = `${window.location.origin}/register?ref=${partner.referralCode}`;
  const daysRemaining = stats.unlockDate
    ? Math.max(0, Math.ceil((new Date(stats.unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              Partner Dashboard
              <span
                className={`text-sm px-3 py-1 rounded-full ${
                  partner.tier === "gold"
                    ? "bg-amber-500/20 text-amber-400"
                    : partner.tier === "silver"
                    ? "bg-slate-400/20 text-slate-300"
                    : "bg-amber-700/20 text-amber-600"
                }`}
              >
                {tierInfo.label}
              </span>
            </h1>
            <p className="text-neutral-400 mt-1">
              Staked {(partner.stakeAmount / 1_000_000).toFixed(0)}M $UNSYS • {tierInfo.revenueShare * 100}% revenue share
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <Link2 className="w-4 h-4" />
              <span className="text-sm font-medium">Your Invite Link</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={copyReferralLink}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">Referral code: {partner.referralCode}</p>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Revenue</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${stats.unclaimedRevenue.toFixed(2)}
            </div>
            <div className="text-sm text-neutral-400">
              Unclaimed • Lifetime: ${stats.lifetimeEarnings.toFixed(2)}
            </div>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Referrals</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.referralCount}</div>
            <div className="text-sm text-neutral-400">Users referred</div>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Payout Method</span>
            </div>
            {partner.stripeAccountStatus === "connected" ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>Stripe connected</span>
              </div>
            ) : (
              <button
                onClick={connectStripe}
                disabled={connectingStripe}
                className="px-4 py-2 bg-[#635BFF] text-white rounded-lg hover:bg-[#5851E1] disabled:opacity-50 flex items-center gap-2"
              >
                {connectingStripe ? "Connecting..." : "Connect Stripe"}
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {partner.unstakeRequestedAt && (
          <div className={`mb-8 rounded-xl p-6 border ${
            stats.isUnstakeLocked 
              ? "bg-amber-500/10 border-amber-500/30" 
              : "bg-red-500/10 border-red-500/30"
          }`}>
            <div className="flex items-center gap-2 text-white mb-2">
              <AlertTriangle className={`w-5 h-5 ${stats.isUnstakeLocked ? "text-amber-400" : "text-red-400"}`} />
              <span className="font-medium">
                {stats.isUnstakeLocked ? "Unstake in Progress" : "Ready to Complete Unstake"}
              </span>
            </div>
            <p className="text-sm text-neutral-400 mb-2">
              {stats.isUnstakeLocked 
                ? `${daysRemaining} days remaining until you can complete your unstake.`
                : "Your 60-day lockup period has ended. You can now complete your unstake."
              }
            </p>
            <p className="text-xs text-neutral-500 mb-4">
              Your plan access will be revoked upon completion. Contact{" "}
              <a href="https://x.com/uncertainsys" target="_blank" rel="noopener noreferrer" className="text-neutral-400 underline">@uncertainsys</a>
              {" "}to arrange token return.
            </p>
            {!stats.isUnstakeLocked && (
              <button
                onClick={confirmUnstake}
                disabled={unstaking}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
              >
                {unstaking ? "Processing..." : "Complete Unstake"}
              </button>
            )}
          </div>
        )}

        <div className="mb-8">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 mb-4"
          >
            {showHowItWorks ? "Hide" : "Show"} how the program works
          </button>
          
          {showHowItWorks && (
            <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
              <h3 className="font-semibold text-white mb-4">How the Partner Program Works</h3>
              <div className="space-y-4 text-sm text-neutral-400">
                <div>
                  <div className="font-medium text-white mb-1">Staking</div>
                  <p>Stake $UNSYS tokens to become a partner. Higher stakes unlock better revenue shares.</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">Referrals</div>
                  <p>Share your unique invite link. When someone signs up with your link, they become linked to your account.</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">Revenue Share</div>
                  <p>Earn {PARTNER_TIERS.bronze.revenueShare * 100}% (Bronze), {PARTNER_TIERS.silver.revenueShare * 100}% (Silver), or {PARTNER_TIERS.gold.revenueShare * 100}% (Gold) of all subscription payments from your referred users.</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">Payouts</div>
                  <p>Connect your Stripe account to receive payouts. Payouts are issued manually by admins.</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">Unstaking</div>
                  <p>Request to unstake at any time. There's a {UNSTAKE_LOCKUP_DAYS}-day lockup period before you can withdraw your tokens.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!partner.unstakeRequestedAt && (
          <button
            onClick={() => setShowUnstakeConfirm(true)}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Want to unstake your $UNSYS?
          </button>
        )}

        {showUnstakeConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-neutral-900 rounded-xl p-6 max-w-md border border-neutral-800">
              <h3 className="text-xl font-bold text-white mb-4">Unstake $UNSYS</h3>
              <p className="text-neutral-400 mb-4">
                Are you sure you want to unstake? You&apos;ll lose your partner status, plan access, and your referral code will no longer work.
              </p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-400">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  60-day lockup period begins now. After the lockup, your partner status and plan access will be removed.
                </p>
                <p className="text-xs text-amber-400/70 mt-2">
                  Contact us at{" "}
                  <a href="https://x.com/uncertainsys" target="_blank" rel="noopener noreferrer" className="underline">@uncertainsys</a>
                  {" "}to arrange return of your $UNSYS tokens after unstaking completes.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUnstakeConfirm(false)}
                  className="flex-1 px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  onClick={requestUnstake}
                  disabled={unstaking}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                >
                  {unstaking ? "Processing..." : "Request Unstake"}
                </button>
              </div>
            </div>
          </div>
        )}

        {partnerData.referredUsers && partnerData.referredUsers.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">Referred Users</h3>
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Username</th>
                    <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerData.referredUsers.map((u) => (
                    <tr key={u.user_id} className="border-b border-neutral-800 last:border-0">
                      <td className="px-4 py-3 text-white">{u.username}</td>
                      <td className="px-4 py-3 text-neutral-400 text-sm">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}