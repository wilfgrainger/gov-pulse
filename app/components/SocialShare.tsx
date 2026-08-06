"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { SITE_SOCIAL_DESCRIPTION, SITE_TITLE } from "@/app/lib/siteCopy";

export const SHARE_SUMMARY = SITE_SOCIAL_DESCRIPTION;

interface SocialShareProps {
  title?: string;
  compact?: boolean;
}

type ShareNetwork = "X" | "Facebook" | "LinkedIn" | "WhatsApp";
const CANONICAL_HOME_URL = "https://public-data.org/";

function getCurrentUrl() {
  return typeof window === "undefined" ? "" : window.location.href;
}

export function buildShareHref(network: ShareNetwork, title: string, url: string) {
  const cleanTitle = title.trim();
  const separator = /[.!?]$/.test(cleanTitle) ? "" : ".";
  const shareText = `${cleanTitle}${separator} ${SHARE_SUMMARY}`;
  switch (network) {
    case "X":
      return `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    case "Facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case "LinkedIn":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case "WhatsApp":
      return `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`;
    default:
      return url;
  }
}

export default function SocialShare({
  title = SITE_TITLE,
  compact = false,
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const showCopiedState = () => {
    setCopied(true);
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimeoutRef.current = null;
    }, 2000);
  };

  const handleCopyLink = async () => {
    const pageUrl = getCurrentUrl();
    try {
      await navigator.clipboard.writeText(pageUrl);
      showCopiedState();
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = pageUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showCopiedState();
    }
  };

  const handleShareClick =
    (network: ShareNetwork) => (event: MouseEvent<HTMLAnchorElement>) => {
      const liveHref = buildShareHref(network, title, getCurrentUrl());
      event.preventDefault();
      window.open(liveHref, "_blank", "noopener,noreferrer");
    };

  const shareLinks: Array<{ name: ShareNetwork; label: string }> = [
    { name: "X", label: "X" },
    { name: "Facebook", label: "Facebook" },
    { name: "LinkedIn", label: "LinkedIn" },
    { name: "WhatsApp", label: "WhatsApp" },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={buildShareHref(link.name, title, CANONICAL_HOME_URL)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleShareClick(link.name)}
            className="border border-[#cbc4b8] px-2 py-1 text-xs font-semibold transition-colors hover:bg-[#172234] hover:text-white"
            title={`Share on ${link.name}`}
          >
            {link.label}
          </a>
        ))}
        <button
          onClick={handleCopyLink}
          className="border border-[#cbc4b8] px-2 py-1 text-xs font-semibold transition-colors hover:bg-[#172234] hover:text-white"
          title="Copy link"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[#d8d3c8] bg-white p-5">
      <div className="mb-3 text-sm font-semibold text-[#172234]">
        Share this evidence
      </div>
      <div className="flex flex-wrap gap-2">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={buildShareHref(link.name, title, CANONICAL_HOME_URL)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleShareClick(link.name)}
            className="border border-[#172234] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#172234] hover:text-white"
            title={`Share on ${link.name}`}
          >
            {link.label}
          </a>
        ))}
        <button
          onClick={handleCopyLink}
          className={`border border-[#172234] px-4 py-2 text-sm font-semibold transition-colors ${
            copied ? "bg-[#172234] text-white" : "bg-white text-[#172234] hover:bg-[#172234] hover:text-white"
          }`}
          title="Copy link to clipboard"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
