"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

interface Lead {
  id: string;
  created_at: string;
  email: string;
  organization: string;
  role: string | null;
  size: string | null;
  audience: string;
  message: string | null;
  status: string;
}

type StatusFilter = "all" | "new" | "contacted" | "converted" | "closed";
type AudienceFilter = "all" | "enterprise" | "schools" | "hr";
type DateFilter = "all" | "7days" | "30days" | "90days" | "year";

const PAGE_SIZE = 25;

export default function LeadsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    checkAdminAndLoadLeads();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, audienceFilter, dateFilter]);

  const checkAdminAndLoadLeads = async () => {
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

      loadLeads();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    try {
      const res = await fetch("/api/admin/leads");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load leads");
      } else {
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error("Load leads error:", err);
      setError("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: StatusFilter) => {
    if (newStatus === "all") return;
    setUpdatingLeadId(leadId);
    try {
      await fetch("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status: newStatus }),
      });
      
      await loadLeads();
    } catch (err) {
      console.error("Status change error:", err);
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const getDateFilterStart = (filter: DateFilter): Date | null => {
    const now = new Date();
    switch (filter) {
      case "7days": now.setDate(now.getDate() - 7); return now;
      case "30days": now.setDate(now.getDate() - 30); return now;
      case "90days": now.setDate(now.getDate() - 90); return now;
      case "year": now.setFullYear(now.getFullYear() - 1); return now;
      default: return null;
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !searchQuery || 
      l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.role || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.message || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    const matchesAudience = audienceFilter === "all" || l.audience === audienceFilter;
    
    const dateStart = getDateFilterStart(dateFilter);
    const leadDate = new Date(l.created_at);
    const matchesDate = !dateStart || leadDate >= dateStart;
    
    return matchesSearch && matchesStatus && matchesAudience && matchesDate;
  });

  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
  const paginatedLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-900/30 text-blue-400";
      case "contacted": return "bg-yellow-900/30 text-yellow-400";
      case "converted": return "bg-green-900/30 text-green-400";
      case "closed": return "bg-neutral-800 text-neutral-400";
      default: return "bg-neutral-800 text-neutral-400";
    }
  };

  const getAudienceColor = (audience: string) => {
    switch (audience) {
      case "enterprise": return "bg-purple-900/30 text-purple-400";
      case "schools": return "bg-cyan-900/30 text-cyan-400";
      case "hr": return "bg-orange-900/30 text-orange-400";
      default: return "bg-neutral-800 text-neutral-400";
    }
  };

  // Stats
  const newLeadsCount = leads.filter(l => l.status === "new").length;
  const contactedCount = leads.filter(l => l.status === "contacted").length;
  const convertedCount = leads.filter(l => l.status === "converted").length;

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
        <h1 className="text-2xl font-bold text-white mt-2">Leads</h1>
        <p className="text-neutral-400 text-sm">{leads.length} total leads from solutions pages</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{leads.length}</div>
          <div className="text-neutral-400 text-sm">Total</div>
        </div>
        <div className="bg-neutral-900/50 border border-blue-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{newLeadsCount}</div>
          <div className="text-neutral-400 text-sm">New</div>
        </div>
        <div className="bg-neutral-900/50 border border-yellow-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{contactedCount}</div>
          <div className="text-neutral-400 text-sm">Contacted</div>
        </div>
        <div className="bg-neutral-900/50 border border-green-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{convertedCount}</div>
          <div className="text-neutral-400 text-sm">Converted</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={t('admin.searchLeads')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value as AudienceFilter)}
          className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
        >
          <option value="all">All Audiences</option>
          <option value="enterprise">Enterprise</option>
          <option value="schools">Schools</option>
          <option value="hr">HR</option>
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
        >
          <option value="all">All Time</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Date</th>
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Contact</th>
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Organization</th>
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Audience</th>
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Message</th>
              <th className="text-left p-4 text-neutral-400 text-sm font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-400">
                  Loading...
                </td>
              </tr>
            ) : paginatedLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-400">
                  No leads found
                </td>
              </tr>
            ) : (
              paginatedLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="p-4 text-neutral-400 text-sm whitespace-nowrap">
                    {formatDate(lead.created_at)}
                  </td>
                  <td className="p-4">
                    <div>
                      <a 
                        href={`mailto:${lead.email}`} 
                        className="text-neutral-200 hover:text-blue-400"
                      >
                        {lead.email}
                      </a>
                      {lead.role && (
                        <div className="text-xs text-neutral-500 mt-0.5">{lead.role}</div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-neutral-300">{lead.organization}</div>
                    {lead.size && (
                      <div className="text-xs text-neutral-500">{lead.size}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${getAudienceColor(lead.audience)}`}>
                      {lead.audience}
                    </span>
                  </td>
                  <td className="p-4 max-w-[300px]">
                    {lead.message ? (
                      <div className="text-neutral-400 text-sm truncate" title={lead.message}>
                        {lead.message}
                      </div>
                    ) : (
                      <span className="text-neutral-600 text-sm">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value as StatusFilter)}
                      disabled={updatingLeadId === lead.id}
                      className={`px-2 py-1 text-xs rounded border bg-neutral-900 border-neutral-700 ${getStatusColor(lead.status).split(" ")[1]}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
    </div>
  );
}
