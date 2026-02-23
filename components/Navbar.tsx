"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface NavbarProps {
  breadcrumbs?: BreadcrumbItem[];
  showNav?: boolean;
}

export function Navbar({ breadcrumbs = [], showNav = true }: NavbarProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="border-b border-neutral-800/60 px-4 sm:px-6 py-4 backdrop-blur-sm bg-[#0a0a0a]/80 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-base sm:text-lg font-semibold text-white tracking-tight hover:text-neutral-300 transition-colors">
            openLesson
          </Link>
          
          {breadcrumbs.length > 0 && (
            <>
              <span className="text-neutral-600">/</span>
              {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  {item.href ? (
                    <Link href={item.href} className="text-neutral-400 hover:text-white text-sm transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-neutral-400 text-sm">{item.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && <span className="text-neutral-600">/</span>}
                </div>
              ))}
            </>
          )}
        </div>

        {showNav && (
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/pricing" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/coaching" className="text-xs sm:text-sm text-neutral-400 hover:text-white text-sm transition-colors">
              Coaching
            </Link>
            <Link href="/dashboard" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
              Dashboard
            </Link>
            
            {isLoggedIn === true ? (
              <button
                onClick={handleSignOut}
                className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors"
              >
                Sign out
              </button>
            ) : isLoggedIn === false && (
              <Link href="/login" className="px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors">
                Sign In
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
