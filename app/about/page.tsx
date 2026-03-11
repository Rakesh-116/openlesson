import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HowItWorks } from "@/components/HowItWorks";
import { FAQ, ABOUT_FAQ_ITEMS } from "@/components/FAQ";
import { DemoBanner } from "@/components/DemoBanner";

export const metadata = {
  title: "About - openLesson",
  description: "openLesson is an AI-powered tutor that listens to you reason and asks guiding questions when it spots gaps. Built by Daniel Colomer of Uncertain Systems.",
  openGraph: {
    title: "About openLesson",
    description: "An AI tutor that listens to you reason and asks questions when it spots gaps. Open source, built on guided questioning.",
    url: "https://openlesson.academy/about",
    siteName: "openLesson",
    type: "website",
  },
};

const VALUES = [
  {
    icon: "🎓",
    title: "Understanding Over Answers",
    description: "We believe the goal of learning is to understand deeply, not to get answers quickly. That's why we never give solutions — only questions.",
  },
  {
    icon: "🔓",
    title: "Open Source",
    description: "Education technology should be accessible to everyone. openLesson is fully open source — run it yourself, modify it, build on it.",
  },
  {
    icon: "🎙️",
    title: "Audio-First",
    description: "Speaking activates different cognitive processes than typing. When you verbalize your reasoning, gaps in understanding become obvious.",
  },
  {
    icon: "🏛️",
    title: "Guided Questioning",
    description: "Questions that guide you to understanding rather than telling you what to think. The best way to learn is to discover answers yourself.",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    icon: "🎯",
    title: "Pick Your Topic",
    description: "Choose what you want to understand better — math, physics, business concepts, anything.",
  },
  {
    icon: "🎙️",
    title: "Think Out Loud",
    description: "Explain your reasoning verbally. Our AI analyzes your speech in real-time for logical gaps.",
  },
  {
    icon: "💡",
    title: "Get Questioned",
    description: "Receive targeted guiding questions that reveal what you don't quite understand yet.",
  },
];

const USE_CASES = [
  {
    icon: "🏠",
    title: "Homeschool",
    description: "Guide your kids through any subject with AI that asks the right questions.",
    href: "/homeschool",
  },
  {
    icon: "🏫",
    title: "Schools",
    description: "Classroom tools that let teachers see how each student thinks.",
    href: "/schools",
  },
  {
    icon: "🏢",
    title: "Enterprise",
    description: "Train teams on products, compliance, and sales through active learning.",
    href: "/enterprise",
  },
  {
    icon: "📜",
    title: "Certifications",
    description: "Prepare for AWS, PMP, and other exams by truly understanding the material.",
    href: "/certify",
  },
];

// TODO: Replace these placeholder video IDs with your actual YouTube video IDs
// Format: Just the video ID from the URL (e.g., "BC7HCkjtOME" from youtube.com/watch?v=BC7HCkjtOME)
const VIDEOS = [
  {
    id: "PLACEHOLDER_VIDEO_1",
    title: "Video Title 1",
    description: "Brief description of this video.",
  },
  {
    id: "PLACEHOLDER_VIDEO_2",
    title: "Video Title 2",
    description: "Brief description of this video.",
  },
  {
    id: "PLACEHOLDER_VIDEO_3",
    title: "Video Title 3",
    description: "Brief description of this video.",
  },
];

const WHY_OPENLESSON = [
  {
    title: "We Listen, Not Lecture",
    description: "ChatGPT answers your questions. openLesson listens to YOUR answers and finds the holes in your reasoning.",
    icon: "👂",
  },
  {
    title: "Audio-First Learning",
    description: "Speaking activates different neural pathways than typing. When you verbalize your thinking, gaps become obvious.",
    icon: "🗣️",
  },
  {
    title: "Never Gives Answers",
    description: "We use guided questioning — leading you to understanding through questions, not handing you solutions.",
    icon: "🤔",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            About openLesson
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight">
            An AI Tutor That Listens to You Think
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            The best way to learn isn't being told the answer—it's discovering it yourself 
            through the right questions. openLesson listens to your reasoning and asks 
            questions that reveal gaps you didn't know you had.
          </p>
        </div>

        {/* How It Works */}
        <div className="mb-16 py-12 border-t border-b border-slate-800">
          <HowItWorks
            title="How openLesson Works"
            steps={HOW_IT_WORKS_STEPS}
            cta={{
              text: "Try Your First Session Free →",
              href: "/register",
            }}
          />
        </div>

        {/* Use Cases */}
        <div className="mb-16">
          <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-3">
            Use It Your Way
          </h2>
          <p className="text-slate-500 text-center text-sm mb-8 max-w-lg mx-auto">
            openLesson adapts to how you learn—at home, in the classroom, or at work.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {USE_CASES.map((useCase) => (
              <Link
                key={useCase.href}
                href={useCase.href}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 hover:bg-slate-900/70 transition-colors group"
              >
                <span className="text-2xl mb-3 block">{useCase.icon}</span>
                <h3 className="text-base font-medium text-white mb-2 group-hover:text-slate-100">
                  {useCase.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {useCase.description}
                </p>
              </Link>
            ))}
          </div>
          
          <p className="text-center mt-6 text-sm text-slate-500">
            Want personalized guidance?{" "}
            <Link href="/coaching" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
              Try 1-on-1 coaching →
            </Link>
          </p>
        </div>

        {/* What Makes openLesson Different */}
        <div className="mb-16">
          <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-3">
            What Makes openLesson Different
          </h2>
          <p className="text-slate-500 text-center text-sm mb-8 max-w-lg mx-auto">
            Most AI tools give you answers. We help you find them yourself.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {WHY_OPENLESSON.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <span className="text-2xl mb-3 block">{item.icon}</span>
                <h3 className="text-base font-medium text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* The Story */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-6">The Story</h2>
          <div className="prose prose-invert max-w-none">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
              <p className="text-slate-300 leading-relaxed">
                For seven years, I've solved hard problems live on camera—quantum mechanics, competition math, 
                theoretical physics—with zero preparation. No scripts. Just real-time thinking, mistakes and all.
              </p>
              <p className="text-slate-300 leading-relaxed">
                I'm Daniel Colomer, and through{" "}
                <a href="https://www.youtube.com/@UncertainSystems" target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-2 hover:text-slate-300">Uncertain Systems</a>, 
                I've done hundreds of hours of streaming and 1-on-1 coaching. Along the way, I noticed something: 
                the students who improved fastest weren't the ones I gave the best explanations to. 
                They were the ones I asked the best <em>questions</em> of.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Guided questioning — asking questions that expose gaps in understanding — has been the gold standard for teaching 
                for millennia. But it doesn't scale. A great tutor has to listen carefully, detect where reasoning 
                breaks down, and ask precisely the right question at the right moment.
              </p>
              <p className="text-slate-300 leading-relaxed">
                That's what openLesson is: an AI that listens to you reason out loud, detects gaps in your understanding, 
                and asks the questions that help you find answers yourself. It never tells you what to think — it helps you 
                think better.
              </p>
            </div>
          </div>
        </div>

        {/* Watch Me Think - YouTube Videos */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-2">Watch Me Think</h2>
          <p className="text-slate-500 text-sm mb-6">
            Real-time problem solving on{" "}
            <a
              href="https://www.youtube.com/@UncertainSystems"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline underline-offset-2"
            >
              Uncertain Systems
            </a>
            . No scripts, no edits.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VIDEOS.map((video) => (
              <div
                key={video.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"
              >
                <div className="aspect-video bg-slate-800">
                  {video.id.startsWith("PLACEHOLDER") ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                      Video placeholder
                    </div>
                  ) : (
                    <iframe
                      src={`https://www.youtube.com/embed/${video.id}`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-white mb-1">{video.title}</h3>
                  <p className="text-xs text-slate-500">{video.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-4">
            <a
              href="https://www.youtube.com/@UncertainSystems"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              Watch more on YouTube
            </a>
          </div>
        </div>

        {/* Our Values */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-6">What We Believe</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VALUES.map((value, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <span className="text-2xl mb-3 block">{value.icon}</span>
                <h3 className="text-base font-medium text-white mb-2">{value.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Open Source */}
        <div className="mb-16">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Fully Open Source</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  openLesson is released under an open source license. You can self-host it, modify it, 
                  and build on it. We believe educational technology should be accessible to everyone.
                </p>
                <a
                  href="https://github.com/dncolomer/openLesson"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors"
                >
                  View on GitHub
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <FAQ items={ABOUT_FAQ_ITEMS} />
        </div>

        {/* Contact */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-6">Get in Touch</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://x.com/uncertainsys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @uncertainsys
            </a>
            <a
              href="mailto:daniel@uncertain.systems"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              daniel@uncertain.systems
            </a>
            <a
              href="https://www.youtube.com/@UncertainSystems"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              YouTube
            </a>
            <a
              href="https://github.com/dncolomer/openLesson"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-3">
            Experience it yourself
          </h2>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Start your first session free. See what guided questioning feels like.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-200 hover:bg-white text-slate-900 text-sm font-medium rounded-xl transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
