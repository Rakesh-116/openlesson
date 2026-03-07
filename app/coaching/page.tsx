import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FAQ, COACHING_FAQ_ITEMS } from "@/components/FAQ";
import { DemoBanner } from "@/components/DemoBanner";

export const metadata = {
  title: "Coaching - openLesson",
  description: "Learn to think through anything. 1-on-1 coaching on solving the hardest problems in math, physics, and beyond — no shortcuts, just thinking. $199.",
  openGraph: {
    title: "Learn to think through anything",
    description: "1-on-1 problem solving coaching. From competition math to quantum physics — build the thinking skills to tackle any problem. $199 session.",
    url: "https://openlesson.academy/coaching",
    siteName: "openLesson",
    images: [
      {
        url: "/coaching-og.jpg",
        width: 1024,
        height: 536,
        alt: "openLesson — Learn to think through anything. 1-on-1 problem solving coaching.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn to think through anything",
    description: "1-on-1 coaching on solving the hardest problems — math, physics, and beyond. Live problem-solving streams since 2019. $199.",
    images: ["/coaching-og.jpg"],
    creator: "@uncertainsys",
  },
};

const VIDEOS = [
  {
    id: "BC7HCkjtOME",
    title: "Humanity's Last Exam (Part 1)",
    description: "Tackling the world's hardest exam live — real-time problem solving with no preparation.",
  },
  {
    id: "I5nBTsHNnlI",
    title: "Gaining Insight is like a brain orgasm",
    description: "On the thinking process, what insight feels like, and how to chase it deliberately.",
  },
  {
    id: "SlvrIxbqMqA",
    title: "Humanity's Last Exam (Part 2)",
    description: "Continuing to work through the world's hardest exam — live reasoning through advanced problems.",
  },
];

const APPROACH = [
  {
    icon: "🧠",
    title: "Think, Don't Memorize",
    description: "Learn to derive answers from first principles instead of recalling formulas.",
  },
  {
    icon: "🔍",
    title: "Find Your Stuck Points",
    description: "Identify exactly where your reasoning breaks down and why.",
  },
  {
    icon: "⚡",
    title: "Build Intuition",
    description: "Develop a feel for when you're on the right track — and when you're not.",
  },
  {
    icon: "🎯",
    title: "Systematic Approach",
    description: "Learn a repeatable process for attacking any unfamiliar problem.",
  },
];

const WHAT_YOULL_GET = [
  {
    icon: "🎯",
    title: "A Systematic Approach",
    description: "A repeatable process for attacking unfamiliar problems that you can use forever.",
  },
  {
    icon: "🔍",
    title: "Your Blind Spots Identified",
    description: "Clarity on exactly where your reasoning tends to break down and why.",
  },
  {
    icon: "💡",
    title: "New Mental Models",
    description: "Frameworks for building intuition and recognizing when you're stuck vs. on track.",
  },
  {
    icon: "📋",
    title: "Personalized Strategies",
    description: "Specific techniques tailored to your goals — competition math, research, certifications.",
  },
];

const PLACEHOLDER_COACHING_TESTIMONIALS = [
  {
    quote: "Daniel helped me see that I wasn't actually understanding proofs — I was just pattern matching. One session completely changed how I approach mathematics.",
    name: "Michael",
    context: "Graduate student, Mathematics",
  },
  {
    quote: "I went from dreading physics problems to actually enjoying them. The systematic approach he taught me works for everything.",
    name: "Sarah",
    context: "Competition math preparation",
  },
];

export default function CoachingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            1-on-1 Coaching
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight">
            Unlock Your Problem-Solving Mind
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            1-on-1 coaching from the creator of Uncertain Systems. Learn the systematic approach 
            to tackling any hard problem — math, physics, CS, or anything else.
          </p>
        </div>

        {/* Two Column Layout: Offer + Approach */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Coaching Offer */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-slate-900/50 p-6 sm:p-8 relative order-2 lg:order-1">
            <div className="absolute -top-3 left-6 px-3 py-0.5 bg-amber-500 text-black text-[11px] font-medium rounded-full">
              Coaching Session
            </div>

            <div className="mb-6 pt-2">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-5xl font-bold text-white">$199</span>
                <span className="text-slate-500 text-sm">one-time</span>
              </div>
              <p className="text-sm text-slate-500">60-90 minute video call</p>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "Personalized 1-on-1 video call",
                "Learn how to think — not what to think",
                "Tackle any problem: math, physics, CS, or anything else",
                "Build a systematic approach to hard problems",
                "Develop intuition for when you're stuck",
                "Strategies for competition math, quantum mechanics, research",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* Cal.com booking - placeholder link */}
            <a
              href="https://cal.com/uncertainsys/coaching"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 text-center text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors flex items-center justify-center gap-2 mb-3"
            >
              <CalendarIcon />
              Book Your Session
            </a>
            <p className="text-[11px] text-slate-600 text-center">
              Or DM <a href="https://x.com/uncertainsys" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">@uncertainsys</a> on X
            </p>
          </div>

          {/* Approach Cards */}
          <div className="order-1 lg:order-2">
            <h2 className="text-lg font-semibold text-white mb-4">The Approach</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {APPROACH.map((item) => (
                <div
                  key={item.title}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/50"
                >
                  <span className="text-2xl mb-2 block">{item.icon}</span>
                  <h3 className="text-sm font-medium text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* What You'll Get Section */}
        <div className="mb-16">
          <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-3">
            What You'll Walk Away With
          </h2>
          <p className="text-slate-500 text-center text-sm mb-8 max-w-lg mx-auto">
            After our session, you'll have the tools to tackle any unfamiliar problem.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHAT_YOULL_GET.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-center"
              >
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="text-sm font-medium text-white mb-2">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-8">
            What Clients Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {PLACEHOLDER_COACHING_TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <svg 
                  className="w-6 h-6 text-slate-700 mb-3" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm text-slate-400 font-medium">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{testimonial.name}</p>
                    <p className="text-xs text-slate-500">{testimonial.context}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Streams Section */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">Live problem solving since 2019</h2>
              <p className="text-sm text-slate-500">
                Real-time thinking sessions on{" "}
                <a
                  href="https://www.youtube.com/@UncertainSystems"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Uncertain Systems
                </a>
                {" "}— no scripts, no edits.
              </p>
            </div>
            <a
              href="https://www.youtube.com/@UncertainSystems"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
            >
              <YoutubeIcon />
              Subscribe
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VIDEOS.map((video) => (
              <div
                key={video.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden group hover:border-slate-700 transition-colors"
              >
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${video.id}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-slate-200 mb-1 group-hover:text-white transition-colors">{video.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{video.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center sm:hidden">
            <a
              href="https://www.youtube.com/@UncertainSystems"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <YoutubeIcon />
              Watch all sessions on YouTube
              <span className="text-slate-700">&rarr;</span>
            </a>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <FAQ items={COACHING_FAQ_ITEMS} />
        </div>

        {/* Testimonial / Quote */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8">
            <svg className="w-8 h-8 text-slate-700 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <p className="text-lg text-slate-300 italic mb-4">
              "The goal isn't to solve problems faster. It's to understand them so deeply that
              the solution becomes obvious."
            </p>
            <p className="text-sm text-slate-500">— The coaching philosophy</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href="https://cal.com/uncertainsys/coaching"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-200 text-black text-sm font-medium rounded-xl transition-colors"
          >
            <CalendarIcon />
            Book your session
          </a>
          <p className="text-xs text-slate-600 mt-3">
            Limited availability — Or DM <a href="https://x.com/uncertainsys" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">@uncertainsys</a> on X
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}

// ---- Icons ----

function YoutubeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
