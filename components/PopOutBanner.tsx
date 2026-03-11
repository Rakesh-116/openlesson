"use client";

import { useEffect, useRef } from "react";

interface PopOutBannerProps {
  isVisible: boolean;
  popOutWindowRef: React.RefObject<Window | null>;
  onDismiss?: () => void;
}

export function PopOutBanner({ isVisible, popOutWindowRef, onDismiss }: PopOutBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);

  // Update visibility via DOM instead of React state
  useEffect(() => {
    if (bannerRef.current) {
      bannerRef.current.style.display = isVisible ? "flex" : "none";
    }
  }, [isVisible]);

  const handleGoToMonitor = () => {
    if (popOutWindowRef.current && !popOutWindowRef.current.closed) {
      popOutWindowRef.current.focus();
    }
  };

  const handleDismiss = () => {
    // Close the pop-out window if it exists
    if (popOutWindowRef.current && !popOutWindowRef.current.closed) {
      popOutWindowRef.current.close();
    }
    // Call the dismiss callback
    onDismiss?.();
  };

  return (
    <div 
      ref={bannerRef}
      style={{ display: "none" }} // Start hidden, controlled via useEffect
      className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-black px-4 py-2 items-center justify-center gap-3"
    >
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span className="font-medium text-sm">
        Do not close this tab — monitoring is running in a separate window
      </span>
      <button
        onClick={handleGoToMonitor}
        className="ml-2 px-3 py-1 bg-black/20 hover:bg-black/30 rounded text-sm font-medium transition-colors"
      >
        Go to Monitor
      </button>
      <button
        onClick={handleDismiss}
        className="ml-1 px-3 py-1 bg-black/30 hover:bg-black/40 rounded text-sm font-medium transition-colors flex items-center gap-1"
        title="Close pop-out and return to ILE"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Dismiss
      </button>
    </div>
  );
}
