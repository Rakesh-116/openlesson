"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

interface User {
  id: string;
  username: string | null;
  email: string | null;
  created_at: string;
  plan: string;
  is_admin: boolean;
  extra_lessons: number;
  subscription_status: string;
  current_period_end: string | null;
  token_tier: string | null;
  token_validity_expires_at: string | null;
  email_confirmed_at: string | null;
  lessons_count: number;
  plans_count: number;
}

type TierOption = "all" | "free" | "regular" | "pro";
type DateFilter = "all" | "7days" | "30days" | "90days" | "year";
type BulkAction = "add_lessons" | "gift_pro" | "gift_regular" | "revoke" | null;

const PAGE_SIZE = 50;

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierOption>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [page, setPage] = useState(1);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkLessonsAmount, setBulkLessonsAmount] = useState(10);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [sortColumn, setSortColumn] = useState<"username" | "lessons_count" | "plans_count" | "created_at" | "plan" | "subscription_status">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const supabase = createClient();

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedUsers(new Set());
    setSelectAll(false);
  }, [searchQuery, tierFilter, dateFilter]);

  const checkAdminAndLoadUsers = async () => {
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

      loadUsers();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load users");
      } else {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Load users error:", err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = async (userId: string, tier: TierOption) => {
    if (tier === "all") return;
    setUpdatingUserId(userId);
    try {
      const updates: Record<string, unknown> = { plan: tier };
      
      if (tier === "pro") {
        updates.subscription_status = "active";
        updates.extra_lessons = 999;
      } else if (tier === "regular") {
        updates.subscription_status = "active";
        updates.extra_lessons = 0;
      } else {
        updates.subscription_status = "inactive";
        updates.extra_lessons = 0;
      }

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to update user");
        return;
      }

      setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update user");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleBulkAction = async () => {
    const targetIds = selectAll 
      ? filteredUsers.map(u => u.id)
      : Array.from(selectedUsers);
    
    if (targetIds.length === 0) return;

    setBulkProcessing(true);
    try {
      for (const userId of targetIds) {
        let updates: Record<string, unknown> = {};

        switch (bulkAction) {
          case "add_lessons":
            const user = users.find(u => u.id === userId);
            updates = { extra_lessons: (user?.extra_lessons ?? 0) + bulkLessonsAmount };
            break;
          case "gift_pro":
            updates = { plan: "pro", subscription_status: "active", extra_lessons: 999 };
            break;
          case "gift_regular":
            updates = { plan: "regular", subscription_status: "active", extra_lessons: 0 };
            break;
          case "revoke":
            updates = { plan: "free", subscription_status: "inactive", extra_lessons: 0 };
            break;
        }

        await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, ...updates }),
        });
      }

      await loadUsers();
      setSelectedUsers(new Set());
      setSelectAll(false);
      setBulkAction(null);
    } catch (err) {
      console.error("Bulk action error:", err);
      alert("Failed to perform bulk action");
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setSelectedUsers(new Set());
    } else {
      setSelectAll(true);
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const getCurrentTier = (user: User): TierOption => {
    if (user.subscription_status === "active" && user.plan === "pro") return "pro";
    if (user.subscription_status === "active" && user.plan === "regular") return "regular";
    return "free";
  };

  const getDateFilterStart = (filter: DateFilter): Date | null => {
    const now = new Date();
    switch (filter) {
      case "7days":
        now.setDate(now.getDate() - 7);
        return now;
      case "30days":
        now.setDate(now.getDate() - 30);
        return now;
      case "90days":
        now.setDate(now.getDate() - 90);
        return now;
      case "year":
        now.setFullYear(now.getFullYear() - 1);
        return now;
      default:
        return null;
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = searchQuery === "" ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const userTier = getCurrentTier(u);
    const matchesTier = tierFilter === "all" || userTier === tierFilter;
    
    const dateStart = getDateFilterStart(dateFilter);
    const userDate = new Date(u.created_at);
    const matchesDate = !dateStart || userDate >= dateStart;
    
    return matchesSearch && matchesTier && matchesDate;
  }).sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortColumn) {
      case "username":
        aVal = (a.username || a.email || "").toLowerCase();
        bVal = (b.username || b.email || "").toLowerCase();
        break;
      case "lessons_count":
        aVal = a.lessons_count || 0;
        bVal = b.lessons_count || 0;
        break;
      case "plans_count":
        aVal = a.plans_count || 0;
        bVal = b.plans_count || 0;
        break;
      case "created_at":
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      case "plan":
        aVal = a.plan;
        bVal = b.plan;
        break;
      case "subscription_status":
        aVal = a.subscription_status;
        bVal = b.subscription_status;
        break;
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const getSortIcon = (column: typeof sortColumn) => {
    if (sortColumn !== column) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: users.length,
    free: users.filter(u => getCurrentTier(u) === "free").length,
    regular: users.filter(u => getCurrentTier(u) === "regular").length,
    pro: users.filter(u => getCurrentTier(u) === "pro").length,
    totalLessons: users.reduce((sum, u) => sum + (u.lessons_count || 0), 0),
    totalPlans: users.reduce((sum, u) => sum + (u.plans_count || 0), 0),
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-900/30 text-green-400";
      case "trialing": return "bg-blue-900/30 text-blue-400";
      case "canceled": return "bg-red-900/30 text-red-400";
      default: return "bg-neutral-700 text-neutral-400";
    }
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const selectedCount = selectAll ? filteredUsers.length - selectedUsers.size + (selectAll ? selectedUsers.size : 0) : selectedUsers.size;
  const actualSelectedCount = selectAll 
    ? filteredUsers.length
    : selectedUsers.size;

  return (
    <main className="max-w-6xl mx-auto p-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-neutral-500 mt-1">Manage users and subscriptions</p>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-semibold">{stats.total}</div>
            <div className="text-sm text-neutral-500">Total Users</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-semibold text-neutral-400">{stats.free}</div>
            <div className="text-sm text-neutral-500">Free</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-semibold text-blue-400">{stats.regular}</div>
            <div className="text-sm text-neutral-500">Regular</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-semibold text-purple-400">{stats.pro}</div>
            <div className="text-sm text-neutral-500">Pro</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-semibold text-green-400">{stats.totalLessons}</div>
            <div className="text-sm text-neutral-500">Total Lessons</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-semibold text-cyan-400">{stats.totalPlans}</div>
            <div className="text-sm text-neutral-500">Total Plans</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by email or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierOption)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All Tiers</option>
            <option value="free">Free</option>
            <option value="regular">Regular</option>
            <option value="pro">Pro</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All Time</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
            <option value="year">Last year</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-white"
            />
            <span className="text-sm text-neutral-400">
              {selectAll ? `All ${filteredUsers.length} (filtered)` : "Select all"}
            </span>
          </div>
          
          {actualSelectedCount > 0 && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-neutral-700">
              <span className="text-sm text-neutral-400">{actualSelectedCount} selected</span>
              <select
                value={bulkAction || ""}
                onChange={(e) => setBulkAction(e.target.value as BulkAction)}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none"
              >
                <option value="">Choose action...</option>
                <option value="add_lessons">Add extra lessons</option>
                <option value="gift_pro">Gift Pro</option>
                <option value="gift_regular">Gift Regular</option>
                <option value="revoke">Revoke access</option>
              </select>
              
              {bulkAction === "add_lessons" && (
                <input
                  type="number"
                  value={bulkLessonsAmount}
                  onChange={(e) => setBulkLessonsAmount(parseInt(e.target.value) || 0)}
                  className="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
                  min="1"
                />
              )}
              
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction || bulkProcessing}
                className="px-3 py-1 text-xs bg-white hover:bg-neutral-200 text-black font-medium rounded transition-colors disabled:opacity-50"
              >
                {bulkProcessing ? "Applying..." : "Apply"}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-neutral-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/50 text-neutral-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("username")}>User{getSortIcon("username")}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("lessons_count")}>Lessons{getSortIcon("lessons_count")}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("plans_count")}>Plans{getSortIcon("plans_count")}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("plan")}>Plan{getSortIcon("plan")}</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("subscription_status")}>Status{getSortIcon("subscription_status")}</th>
                <th className="px-4 py-3 font-medium">Extra Lessons</th>
                <th className="px-4 py-3 font-medium">Token Tier</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("created_at")}>Joined{getSortIcon("created_at")}</th>
                <th className="px-4 py-3 font-medium">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {paginatedUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-neutral-900/30 ${selectedUsers.has(user.id) ? "bg-green-900/10" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectAll ? true : selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-white"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/${user.id}`} className="hover:text-blue-400">
                      <div>
                        <div className="text-neutral-200 font-medium">
                          {user.username || user.email || "No name"}
                        </div>
                        <div className="text-xs text-neutral-500">{user.email}</div>
                        {user.is_admin && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            ADMIN
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {user.lessons_count}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {user.plans_count}
                  </td>
                  <td className="px-4 py-3">
                    <span className={getPlanColor(user.plan)}>{user.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(user.subscription_status)}`}>
                      {user.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400 min-w-[20px]">{user.extra_lessons ?? 0}</span>
                      {[1, 10, 100].map((amount) => (
                        <button
                          key={amount}
                          onClick={async () => {
                            const newCount = (user.extra_lessons ?? 0) + amount;
                            const res = await fetch("/api/admin/users", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: user.id, extra_lessons: newCount }),
                            });
                            if (res.ok) {
                              setUsers(users.map(u => u.id === user.id ? { ...u, extra_lessons: newCount } : u));
                            }
                          }}
                          className="text-xs px-1.5 py-0.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded transition-colors"
                        >
                          +{amount}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {user.token_tier || "-"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={getCurrentTier(user)}
                      onChange={(e) => handleTierChange(user.id, e.target.value as TierOption)}
                      disabled={updatingUserId === user.id}
                      className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500 disabled:opacity-50"
                    >
                      <option value="free">Free</option>
                      <option value="regular">Regular</option>
                      <option value="pro">Pro</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-neutral-500">
              No users found
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
            <div className="text-sm text-neutral-500">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-xs text-neutral-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
  );
}
