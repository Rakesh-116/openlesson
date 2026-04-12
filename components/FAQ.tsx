"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
  title?: string;
  variant?: "accordion" | "list";
}

export function FAQ({ 
  items, 
  title = "Frequently Asked Questions",
  variant = "accordion"
}: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (variant === "list") {
    return (
      <div className="w-full max-w-3xl mx-auto px-4">
        {title && (
          <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-8">
            {title}
          </h2>
        )}
        
        <div className="space-y-6">
          {items.map((item, index) => (
            <div key={index}>
              <h3 className="text-sm font-medium text-white mb-2">
                {item.question}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {title && (
        <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-8">
          {title}
        </h2>
      )}
      
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"
          >
            <button
              onClick={() => toggleItem(index)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
            >
              <span className="text-sm font-medium text-white pr-4">
                {item.question}
              </span>
              <svg
                className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                  openIndex === index ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            
            <div
              className={`overflow-hidden transition-all duration-200 ${
                openIndex === index ? "max-h-96" : "max-h-0"
              }`}
            >
              <p className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
                {item.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pricing page FAQ items
export const getPricingFaqItems = (t: (key: string) => string): FAQItem[] => [
  {
    question: t('pricing.faqCancel'),
    answer: t('pricing.faqCancelAnswer'),
  },
  {
    question: t('pricing.faqDowngrade'),
    answer: t('pricing.faqDowngradeAnswer'),
  },
  {
    question: t('pricing.faqExtraSessions'),
    answer: t('pricing.faqExtraSessionsAnswer'),
  },
  {
    question: t('pricing.faqSessionVsPlan'),
    answer: t('pricing.faqSessionVsPlanAnswer'),
  },
  {
    question: t('pricing.faqTeam'),
    answer: t('pricing.faqTeamAnswer'),
  },
  {
    question: t('pricing.faqPrivacy'),
    answer: t('pricing.faqPrivacyAnswer'),
  },
];

// Coaching page FAQ items
export const getCoachingFaqItems = (t: (key: string) => string): FAQItem[] => [
  {
    question: t('coaching.faqTopics'),
    answer: t('coaching.faqTopicsAnswer'),
  },
  {
    question: t('coaching.faqPrepare'),
    answer: t('coaching.faqPrepareAnswer'),
  },
  {
    question: t('coaching.faqFollowUp'),
    answer: t('coaching.faqFollowUpAnswer'),
  },
  {
    question: t('coaching.faqLevel'),
    answer: t('coaching.faqLevelAnswer'),
  },
  {
    question: t('coaching.faqConnection'),
    answer: t('coaching.faqConnectionAnswer'),
  },
];

// About page FAQ items
export const getAboutFaqItems = (t: (key: string) => string): FAQItem[] => [
  {
    question: t('about.faqLanguages'),
    answer: t('about.faqLanguagesAnswer'),
  },
  {
    question: t('about.faqToken'),
    answer: t('about.faqTokenAnswer'),
  },

  {
    question: t('about.faqDifference'),
    answer: t('about.faqDifferenceAnswer'),
  },
  {
    question: t('about.faqFree'),
    answer: t('about.faqFreeAnswer'),
  },
  {
    question: t('about.faqSubject'),
    answer: t('about.faqSubjectAnswer'),
  },
  {
    question: t('about.faqAudio'),
    answer: t('about.faqAudioAnswer'),
  },
];
