"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const DEMO_URL = "https://cal.com/daniel-colomer-lvwg8w/openlesson-demo?overlayCalendar=true";

export function DemoBanner() {
  const { t } = useI18n();
  
  return (
    <div className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-2 text-sm">
        <span className="text-slate-300">{t('demoBanner.wantToSee')}</span>
        <Link
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-medium underline underline-offset-2 hover:text-slate-200 transition-colors"
        >
          {t('demoBanner.scheduleDemo')}
        </Link>
      </div>
    </div>
  );
}
