"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const solutionsRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (solutionsRef.current && !solutionsRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    router.push("/");
    router.refresh();
  };

  const solutionsItems = [
    { href: "/", label: t('nav.forIndividuals'), desc: t('nav.personalLearning') },
    { href: "/enterprise", label: t('nav.forSales'), desc: t('nav.teamTraining') },
    { href: "/eval", label: t('nav.forHR'), desc: t('nav.candidateTesting') },
    { href: "/homeschool", label: t('nav.forFamilies'), desc: t('nav.homeschool') },
    { href: "/schools", label: t('nav.forSchools'), desc: t('nav.teachers') },
    { href: "/certify", label: t('nav.forCareers'), desc: t('nav.certificationPrep') },
  ];

  const navLinks = [
    { href: "/pricing", label: t('nav.pricing') },
    { href: "/coaching", label: t('nav.coaching') },
    { href: "/about", label: t('nav.about') },
    { href: "/dashboard", label: t('nav.dashboard') },
  ];

  return (
    <header className="border-b border-slate-800/60 px-4 sm:px-6 py-4 backdrop-blur-sm bg-[#0a0a0a]/80 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-base sm:text-lg font-semibold text-white tracking-tight hover:text-slate-300 transition-colors">
            {t('nav.openLesson')}
          </Link>
          
          {breadcrumbs.length > 0 && (
            <>
              <span className="text-slate-600 hidden sm:inline">/</span>
              {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  {item.href ? (
                    <Link href={item.href} className="text-slate-400 hover:text-white text-sm transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-slate-400 text-sm">{item.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && <span className="text-slate-600 hidden sm:inline">/</span>}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Desktop Navigation */}
        {showNav && (
          <div className="hidden md:flex items-center gap-4">
            {/* Solutions Dropdown */}
            <div className="relative" ref={solutionsRef}>
              <button
                onClick={() => setSolutionsOpen(!solutionsOpen)}
                className="text-xs sm:text-sm text-slate-500 hover:text-white transition-colors inline-flex items-center gap-1"
              >
                {t('nav.solutions')}
                <svg className={`w-3 h-3 transition-transform ${solutionsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {solutionsOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-2 z-50">
                  {solutionsItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSolutionsOpen(false)}
                      className="block px-4 py-2 hover:bg-slate-800 transition-colors"
                    >
                      <p className="text-sm text-white">{item.label}</p>
                      <p className="text-[10px] text-slate-500">{item.desc}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                className="text-xs sm:text-sm text-slate-500 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <LanguageSwitcher />
            
            {isLoggedIn === true ? (
              <button
                onClick={handleSignOut}
                className="text-xs sm:text-sm text-slate-500 hover:text-white transition-colors"
              >
                {t('nav.signOut')}
              </button>
            ) : isLoggedIn === false && (
              <Link href="/login" className="px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        )}

        {/* Mobile Menu Button */}
        {showNav && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {showNav && mobileMenuOpen && (
        <div className="md:hidden mt-4 pb-4 border-t border-slate-800 pt-4">
          <nav className="flex flex-col gap-4">
            <div className="mb-2">
              <span className="text-xs text-slate-600 uppercase tracking-wider">Solutions</span>
            </div>
            {solutionsItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors pl-2 border-l border-slate-800"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-slate-800 my-2" />
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            
            {isLoggedIn === true ? (
              <button
                onClick={() => {
                  handleSignOut();
                  setMobileMenuOpen(false);
                }}
                className="text-sm text-slate-400 hover:text-white transition-colors text-left"
              >
                Sign out
              </button>
            ) : isLoggedIn === false && (
              <Link 
                href="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
