import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Use Cases - openLesson",
  description: "Discover how openLesson powers learning for individuals, enterprises, and institutions.",
};

export default function UseCasesPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-14">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            Use Cases
          </h1>
          <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            From daily learning to enterprise training — openLesson adapts to any learning need.
          </p>
        </div>

        {/* What Makes OpenLesson Special */}
        <div className="mb-14 p-6 rounded-2xl border border-neutral-700 bg-neutral-900/60">
          <h2 className="text-lg font-semibold text-white mb-4">What Makes OpenLesson.academy's Approach Special</h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            OpenLesson.academy works differently from most learning tools. 
            The tool is able to recognize thinking and reasoning patterns and progressively adapt to how you think in order to optimize the learning strategy. 
            This means every session is adjusted in real time to match your personal way of understanding things. As a result, you make clearer progress whether you are doing daily learning sessions, preparing for exams or interviews, or following long-term plans to build new skills in any subject.
          </p>
        </div>

        {/* For Consumers */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white">For Consumers</h2>
          </div>
          
          <p className="text-neutral-400 text-sm mb-6">
            Individuals, Students, Professionals, and Lifelong Learners
          </p>

          <div className="grid gap-4">
            {[
              {
                title: "Daily Learning Sessions",
                description: "Spend 10–20 minutes a day deepening your understanding of any subjects or topics you choose.",
              },
              {
                title: "Exam and Interview Preparation",
                description: "Prepare for school exams, certifications, or job interviews in any field.",
              },
              {
                title: "Long-term Skill Building",
                description: "Follow learning plans over weeks or months to learn new skills or strengthen existing knowledge.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5"
              >
                <h3 className="text-base font-medium text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For Enterprise */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white">For Enterprise</h2>
          </div>
          
          <p className="text-neutral-400 text-sm mb-6">
            Companies and Corporate Training Teams
          </p>

          <div className="grid gap-4">
            {[
              {
                title: "Employee Skill Development",
                description: "Train teams across any department on the knowledge and capabilities they need for their roles.",
              },
              {
                title: "New Hire Onboarding and Role-Specific Training",
                description: "Onboard new employees and deliver targeted training on product knowledge, sales processes, customer service, compliance, or other job requirements.",
              },
              {
                title: "On-Demand Employee Upskilling",
                description: "Let staff quickly learn or refresh specific skills exactly when they need them for current work.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5"
              >
                <h3 className="text-base font-medium text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-5 rounded-xl border border-purple-500/20 bg-purple-500/5">
            <p className="text-sm text-neutral-400 mb-3">
              Need a custom deployment with pre-loaded knowledge bases tailored to your organization?
            </p>
            <a
              href="mailto:daniel@uncertain.systems"
              className="inline-flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              Contact daniel@uncertain.systems
              <span className="text-purple-500">→</span>
            </a>
          </div>
        </section>

        {/* For Schools and Public Institutions */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white">For Schools and Public Institutions</h2>
          </div>
          
          <p className="text-neutral-400 text-sm mb-6">
            K-12, Universities, Libraries, Government Programs
          </p>

          <div className="grid gap-4">
            {[
              {
                title: "Homework, Afterschool and Homeschooling Support",
                description: "Help students with homework and provide structured support for afterschool programs and homeschooling.",
              },
              {
                title: "Personalized Learning for Every Student",
                description: "Automatically adjust the level and pace for gifted students, average learners, and those who need extra help.",
              },
              {
                title: "Curriculum-Aligned Learning Plans",
                description: "Support regular school subjects with learning paths that match the official curriculum and standards.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5"
              >
                <h3 className="text-base font-medium text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-black bg-white hover:bg-neutral-200 rounded-xl transition-colors"
          >
            Get Started
            <span className="text-neutral-500">→</span>
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
