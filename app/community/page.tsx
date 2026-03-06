"use client";

import { CommunityPlans } from "@/components/CommunityPlans";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function CommunityPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            Community Plans
          </h1>
          <p className="text-neutral-500 text-base max-w-lg mx-auto leading-relaxed">
            Explore learning plans created by other learners and remix them to create your own.
          </p>
        </div>

        <CommunityPlans user={null} />
      </div>

      <Footer />
    </main>
  );
}
