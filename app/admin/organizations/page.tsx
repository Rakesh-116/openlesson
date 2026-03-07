"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  pending_invites: number;
}

const PAGE_SIZE = 25;

export default function OrganizationsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");

  useEffect(() => {
    checkAdminAndLoadOrgs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const checkAdminAndLoadOrgs = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", authUser.id)
        .single();

      if (!profile?.is_admin) {
        setError("Admin access required");
        setLoading(false);
        return;
      }

      loadOrganizations();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load organizations");
      } else {
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error("Load organizations error:", err);
      setError("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim(), slug: newOrgSlug.trim().toLowerCase() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to create organization");
      } else {
        setShowCreateModal(false);
        setNewOrgName("");
        setNewOrgSlug("");
        loadOrganizations();
      }
    } catch (err) {
      console.error("Create org error:", err);
      alert("Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = !searchQuery || 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredOrgs.length / PAGE_SIZE);
  const paginatedOrgs = filteredOrgs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/admin" className="text-neutral-400 hover:text-white text-sm">
          &larr; Back to Admin
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Organizations</h1>
            <p className="text-neutral-400 text-sm">{organizations.length} total organizations</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Create Organization
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Organization</th>
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Slug</th>
              <th className="text-right p-4 text-neutral-400 text-sm font-medium">Members</th>
              <th className="text-right p-4 text-neutral-400 text-sm font-medium">Pending Invites</th>
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-400">
                  Loading...
                </td>
              </tr>
            ) : paginatedOrgs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-400">
                  No organizations found
                </td>
              </tr>
            ) : (
              paginatedOrgs.map((org) => (
                <tr key={org.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="p-4">
                    <Link href={`/admin/organizations/${org.id}`} className="hover:text-blue-400">
                      <div className="text-neutral-200 font-medium">{org.name}</div>
                    </Link>
                  </td>
                  <td className="p-4">
                    <code className="text-xs text-neutral-400 bg-neutral-800 px-2 py-1 rounded">
                      {org.slug}
                    </code>
                  </td>
                  <td className="p-4 text-right text-neutral-300">
                    {org.member_count}
                  </td>
                  <td className="p-4 text-right">
                    {org.pending_invites > 0 ? (
                      <span className="text-yellow-400">{org.pending_invites}</span>
                    ) : (
                      <span className="text-neutral-500">0</span>
                    )}
                  </td>
                  <td className="p-4 text-neutral-400 text-sm">
                    {formatDate(org.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-neutral-700"
          >
            Previous
          </button>
          <span className="text-neutral-400 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-neutral-700"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Create Organization</h2>
            <form onSubmit={handleCreateOrg}>
              <div className="mb-4">
                <label className="block text-sm text-neutral-400 mb-2">Organization Name</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug || newOrgSlug === generateSlug(newOrgName)) {
                      setNewOrgSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder="Acme Corp"
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm text-neutral-400 mb-2">Slug (URL identifier)</label>
                <input
                  type="text"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="acme-corp"
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewOrgName("");
                    setNewOrgSlug("");
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newOrgName.trim() || !newOrgSlug.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
