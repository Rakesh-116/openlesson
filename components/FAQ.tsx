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
    answer: "Session mode is for learning a single topic right now through guided dialogue. Plan mode creates a multi-week learning roadmap for bigger goals like certification prep or mastering a subject.",
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
    answer: "Both. Guided questioning works at any level — I meet you where you are and help you get unstuck, whether that's basic algebra or graduate-level quantum mechanics.",
  },
  {
    question: "What's the connection to openLesson?",
    answer: "I built openLesson to scale the coaching approach to everyone. The AI tutor uses the same guided questioning methodology. Coaching is the premium, personalized version with a human.",
  },
];

// About page FAQ items
export const ABOUT_FAQ_ITEMS: FAQItem[] = [
  {
    question: "What languages does openLesson support?",
    answer: "openLesson currently supports English only. We're actively working on adding support for Spanish, French, German, Portuguese, and other languages — coming soon!",
  },
  {
    question: "What is the $UNSYS token?",
    answer: "The $UNSYS token is a Solana-based token that lets you financially support openLesson and become a Partner. Partners stake tokens and earn revenue share (10-50%) from users they refer. It's our way of aligning incentives with our community. Learn more in the Partner dashboard.",
  },
  {
    question: "How does the Partner program work?",
    answer: "Stake $UNSYS tokens to become a Partner and earn revenue share from your referrals. Bronze (1M tokens) earns 10%, Silver (2M) earns 30%, and Gold (5M) earns 50%. Partners get a unique referral link and can track earnings in their dashboard.",
  },
  {
    question: "How is this different from ChatGPT or other AI tutors?",
    answer: "Most AI tools give you answers when you ask questions. openLesson flips this: it listens to YOUR answers and asks you questions when it detects gaps in your reasoning. It's the Socratic method, powered by AI.",
  },
  {
    question: "Is openLesson free?",
    answer: "We offer a free tier with limited sessions per month. For unlimited learning, check out our Regular ($9.99/mo) or Unlimited ($19.99/mo) plans on the pricing page.",
  },
  {
    question: "Can I use openLesson for any subject?",
    answer: "Yes! openLesson works for any topic you want to understand better — math, physics, history, business concepts, certification prep, and more. If you can explain it, we can question it.",
  },
  {
    question: "Is my audio recorded or stored?",
    answer: "Audio is processed in real-time for analysis only. We don't store your voice recordings unless you explicitly choose to upload them. See our Privacy Policy for details.",
  },
];
