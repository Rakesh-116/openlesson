"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { useI18n } from "@/lib/i18n";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export function QRCodeModal({ isOpen, onClose, sessionId }: QRCodeModalProps) {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Get the mobile session URL
  const getMobileUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/session/mobile/${sessionId}`;
  }, [sessionId]);

  const mobileUrl = isClient ? getMobileUrl() : "";

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Generate QR code when modal opens
  useEffect(() => {
    if (!isOpen || !mobileUrl) return;

    QRCode.toDataURL(mobileUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: "#ffffff",
        light: "#0a0a0a",
      },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [isOpen, mobileUrl]);

  // Copy URL to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mobileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-sm mx-4 bg-[#0a0a0a] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{t('qrCode.openOnSmartphone')}</h2>
              <p className="text-[10px] text-neutral-500">{t('qrCode.scanToContinue')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div className="p-6 flex flex-col items-center">
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-neutral-800">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center">
            <p className="text-xs text-neutral-400 mb-1">
              {t('qrCode.scanWithCamera')}
            </p>
            <p className="text-[10px] text-neutral-600">
              {t('qrCode.mobileSessionIndependent')}
            </p>
          </div>
        </div>

        {/* URL Section */}
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 p-2 bg-neutral-900 border border-neutral-800 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-neutral-500 mb-0.5">{t('qrCode.sessionUrl')}</p>
              <p className="text-xs text-neutral-300 truncate font-mono">
                {mobileUrl}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                copied
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 hover:text-neutral-300"
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('qrCode.copied')}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('qrCode.copy')}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Footer tip */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-2 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
            <svg className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[10px] text-cyan-400/80 leading-relaxed">
              {t('qrCode.mobileViewTip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
