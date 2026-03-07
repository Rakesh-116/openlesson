"use client";

import { useState } from "react";

type Audience = "enterprise" | "schools" | "hr";

interface LeadCaptureProps {
  audience: Audience;
  title?: string;
  subtitle?: string;
  submitText?: string;
}

const ROLE_OPTIONS: Record<Audience, string[]> = {
  enterprise: ["Sales Leader", "Training Manager", "L&D Manager", "HR Director", "Executive"],
  schools: ["Teacher", "Department Head", "Principal", "District Admin", "IT Admin"],
  hr: ["HR Manager", "Recruiter", "Talent Acquisition Lead", "Hiring Manager", "HR Director"],
};

const SIZE_OPTIONS = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-500", label: "201-500" },
  { value: "500+", label: "500+" },
];

const DEFAULT_TITLES: Record<Audience, string> = {
  enterprise: "Get Early Access to Team Features",
  schools: "Request a School Pilot",
  hr: "Request a Demo for Your Team",
};

const DEFAULT_SUBTITLES: Record<Audience, string> = {
  enterprise: "Join the waitlist for team dashboards, SSO, and enterprise features.",
  schools: "We're partnering with early-adopter educators to build classroom tools.",
  hr: "See how conversational assessments can improve your hiring process.",
};

export function LeadCapture({
  audience,
  title,
  subtitle,
  submitText = "Request Access",
}: LeadCaptureProps) {
  const [formData, setFormData] = useState({
    email: "",
    organization: "",
    role: "",
    size: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          audience,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (submitted) {
    return (
      <div className="w-full">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <svg
            className="w-12 h-12 text-emerald-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">Thanks for your interest!</h3>
          <p className="text-sm text-slate-400">
            We'll be in touch soon to discuss how openLesson can help your{" "}
            {audience === "schools" ? "school" : "organization"}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          {title || DEFAULT_TITLES[audience]}
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          {subtitle || DEFAULT_SUBTITLES[audience]}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs text-slate-400 mb-1.5">
              Work Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@company.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Organization */}
          <div>
            <label htmlFor="organization" className="block text-xs text-slate-400 mb-1.5">
              {audience === "schools" ? "School Name" : "Company Name"} *
            </label>
            <input
              type="text"
              id="organization"
              name="organization"
              required
              value={formData.organization}
              onChange={handleChange}
              placeholder={audience === "schools" ? "Springfield High School" : "Acme Corp"}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-xs text-slate-400 mb-1.5">
              Your Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
            >
              <option value="">Select your role</option>
              {ROLE_OPTIONS[audience].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Size */}
          <div>
            <label htmlFor="size" className="block text-xs text-slate-400 mb-1.5">
              {audience === "schools" ? "Number of Students" : "Team Size"}
            </label>
            <select
              id="size"
              name="size"
              value={formData.size}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
            >
              <option value="">Select size</option>
              {SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-xs text-slate-400 mb-1.5">
              Anything else we should know? (optional)
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={3}
              placeholder="Tell us about your use case..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 text-sm font-medium text-slate-900 bg-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            {isSubmitting ? "Submitting..." : submitText}
          </button>
        </form>
      </div>
    </div>
  );
}
