'use client';

import { useI18n, languageNames } from '@/lib/i18n';
import { ChevronDown, Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher() {
  const { locale, setLocale, supportedLocales, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        aria-label={t('language.select')}
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{languageNames[locale]}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50">
          {supportedLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                setLocale(loc);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 first:rounded-t-md last:rounded-b-md ${
                locale === loc ? 'bg-slate-700 font-medium text-white' : 'text-slate-200'
              }`}
            >
              {languageNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
