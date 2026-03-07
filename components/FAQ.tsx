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
export const PRICING_FAQ_ITEMS: FAQItem[] = [
  {
    question: "Can I cancel anytime?",
    answer: "Yes. Cancel directly from your Stripe dashboard whenever you want. No questions asked, no cancellation fees.",
  },
  {
    question: "What happens to my sessions if I downgrade?",
    answer: "Your session history is always available. You just won't be able to start new sessions beyond your plan limit until you upgrade again.",
  },
  {
    question: "How do extra sessions work?",
    answer: "On Free or Regular plans, you can buy individual sessions for $1.99 each. They never expire and are added to your account immediately.",
  },
  {
    question: "What's the difference between Session and Plan mode?",
    answer: "Session mode is for learning a single topic right now through Socratic dialogue. Plan mode creates a multi-week learning roadmap for bigger goals like certification prep or mastering a subject.",
  },
  {
    question: "Can I use openLesson for my team or classroom?",
    answer: "The current plans are designed for individuals. We're actively building team and classroom features — contact us at daniel@uncertain.systems for early access.",
  },
  {
    question: "Is my data private?",
    answer: "Yes. Audio is processed for real-time analysis only and is not stored unless you explicitly choose to upload it. See our Privacy Policy for full details.",
  },
];

// Coaching page FAQ items
export const COACHING_FAQ_ITEMS: FAQItem[] = [
  {
    question: "What topics can we cover?",
    answer: "Anything you want to think more clearly about — math (any level), physics, computer science, problem-solving strategy, research methodology, or general reasoning skills.",
  },
  {
    question: "How should I prepare?",
    answer: "Bring 1-3 specific problems or concepts you're struggling with. The more concrete your examples, the better we can work together to identify and address your stuck points.",
  },
  {
    question: "What if I need follow-up sessions?",
    answer: "Many clients find 2-3 sessions valuable. DM me on X (@uncertainsys) to discuss package options or ongoing coaching arrangements.",
  },
  {
    question: "Is this for beginners or advanced learners?",
    answer: "Both. The Socratic method works at any level — I meet you where you are and help you get unstuck, whether that's basic algebra or graduate-level quantum mechanics.",
  },
  {
    question: "What's the connection to openLesson?",
    answer: "I built openLesson to scale the coaching approach to everyone. The AI tutor uses the same Socratic methodology. Coaching is the premium, personalized version with a human.",
  },
];
