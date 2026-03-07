"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface Member {
  id: string;
  username: string | null;
  email: string | null;
  is_org_admin: boolean;
  created_at: string;
  plan: string;
  subscription_status: string;
}

interface Invite {
  id: string;
  token: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export default function OrganizationPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [generatingInvites, setGeneratingInvites] = useState(false);
  const [inviteCount, setInviteCount] = useState(1);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }
      
      setCurrentUserId(user.id);

      const res = await fetch("/api/organization");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load organization");
        setLoading(false);
        return;
      }

      setOrganization(data.organization);
      setIsOrgAdmin(data.is_org_admin);
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } catch (err) {
      console.error("Load organization error:", err);
      setError("Failed to load organization");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvites = async () => {
    setGeneratingInvites(true);
    try {
      const res = await fetch("/api/organization/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: inviteCount }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to generate invites");
      } else {
        setShowInviteModal(false);
        setInviteCount(1);
        loadOrganization();
      }
    } catch (err) {
      console.error("Generate invites error:", err);
      alert("Failed to generate invites");
    } finally {
      setGeneratingInvites(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invite?")) return;
    
    try {
      const res = await fetch("/api/organization/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to revoke invite");
      } else {
        loadOrganization();
      }
    } catch (err) {
      console.error("Delete invite error:", err);
      alert("Failed to revoke invite");
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const isSelf = memberId === currentUserId;
    const message = isSelf 
      ? "Are you sure you want to leave this organization?"
      : `Remove ${memberName} from this organization?`;
    
    if (!confirm(message)) return;
    
    setRemovingMember(memberId);
    try {
      const res = await fetch("/api/organization/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to remove member");
      } else {
        if (isSelf) {
          // User left the org, refresh the page
          router.refresh();
          loadOrganization();
        } else {
          loadOrganization();
        }
      }
    } catch (err) {
      console.error("Remove member error:", err);
      alert("Failed to remove member");
    } finally {
      setRemovingMember(null);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    alert("Invite link copied to clipboard!");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "pro": return "text-purple-400";
      case "regular": return "text-blue-400";
      default: return "text-neutral-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navbar />
        <div className="max-w-5xl mx-auto p-6">
          <div className="text-neutral-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navbar />
        <div className="max-w-5xl mx-auto p-6">
          <div className="text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  // No organization
  if (!organization) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navbar />
        <div className="max-w-5xl mx-auto p-6">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">No Organization</h1>
            <p className="text-neutral-400 mb-6">
              You&apos;re not part of any organization yet. Ask your organization admin for an invite link to join.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const unusedInvites = invites.filter(i => !i.used_by);
  const usedInvites = invites.filter(i => i.used_by);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard" className="text-neutral-400 hover:text-white text-sm">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">{organization.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <code className="text-sm text-neutral-400 bg-neutral-800 px-2 py-1 rounded">
              {organization.slug}
            </code>
            {isOrgAdmin && (
              <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Org Admin
              </span>
            )}
          </div>
        </div>

        {/* Stats (for org admins) */}
        {isOrgAdmin && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{members.length}</div>
              <div className="text-neutral-400 text-sm">Members</div>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">
                {members.filter(m => m.is_org_admin).length}
              </div>
              <div className="text-neutral-400 text-sm">Admins</div>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">{unusedInvites.length}</div>
              <div className="text-neutral-400 text-sm">Pending Invites</div>
            </div>
          </div>
        )}

        {/* Members (for org admins) */}
        {isOrgAdmin && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg mb-6">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-lg font-semibold text-white">Members</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left p-4 text-neutral-400 text-sm font-medium">User</th>
                  <th className="text-left p-4 text-neutral-400 text-sm font-medium">Plan</th>
                  <th className="text-left p-4 text-neutral-400 text-sm font-medium">Role</th>
                  <th className="text-right p-4 text-neutral-400 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                    <td className="p-4">
                      <div className="text-neutral-200">{member.username || member.email || "Unknown"}</div>
                      <div className="text-xs text-neutral-500">{member.email}</div>
                      {member.id === currentUserId && (
                        <span className="text-xs text-blue-400">(you)</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={getPlanColor(member.plan)}>{member.plan}</span>
                    </td>
                    <td className="p-4">
                      {member.is_org_admin ? (
                        <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          Admin
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-sm">Member</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleRemoveMember(member.id, member.username || member.email || "this user")}
                        disabled={removingMember === member.id}
                        className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors disabled:opacity-50"
                      >
                        {member.id === currentUserId ? "Leave" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invites (for org admins) */}
        {isOrgAdmin && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Invite Links</h2>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                Generate Invites
              </button>
            </div>
            
            {invites.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">
                No invites generated yet. Click &quot;Generate Invites&quot; to create invite links.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/50">
                {/* Unused invites first */}
                {unusedInvites.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-neutral-800/20">
                    <div>
                      <code className="text-sm text-green-400 bg-green-900/20 px-2 py-1 rounded">
                        {invite.token}
                      </code>
                      <div className="text-xs text-neutral-500 mt-1">
                        Created {formatDate(invite.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyInviteLink(invite.token)}
                        className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(invite.id)}
                        className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Used invites */}
                {usedInvites.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between opacity-60">
                    <div>
                      <code className="text-sm text-neutral-500 bg-neutral-800 px-2 py-1 rounded line-through">
                        {invite.token}
                      </code>
                      <div className="text-xs text-neutral-500 mt-1">
                        Used on {formatDate(invite.used_at)}
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs bg-neutral-800 text-neutral-500 rounded">
                      Used
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Non-admin view */}
        {!isOrgAdmin && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
            <p className="text-neutral-400 mb-4">
              You are a member of this organization. Contact your organization admin if you need to invite new members or manage settings.
            </p>
            <button
              onClick={() => handleRemoveMember(currentUserId!, "yourself")}
              disabled={removingMember === currentUserId}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
            >
              Leave Organization
            </button>
          </div>
        )}

        {/* Generate Invites Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-white mb-4">Generate Invite Links</h2>
              <div className="mb-6">
                <label className="block text-sm text-neutral-400 mb-2">Number of invites</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={inviteCount}
                  onChange={(e) => setInviteCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                />
                <p className="text-xs text-neutral-500 mt-1">Each invite can only be used once (max 50)</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteCount(1);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateInvites}
                  disabled={generatingInvites}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {generatingInvites ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
