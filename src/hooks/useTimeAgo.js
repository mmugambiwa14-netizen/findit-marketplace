import { useState, useEffect } from "react";

function computeTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  // Ensure UTC parsing — append Z if no timezone info present
  const normalized = /[Z+\-]\d*$/.test(dateStr.trim()) ? dateStr : dateStr + "Z";
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "";
  const diffMs = now - date.getTime();
  // If in the future (clock skew), show "Just now"
  if (diffMs < 0) return "Just now";
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

/**
 * Returns a live-updating "time ago" string that refreshes every minute.
 * Pass a single ISO date string.
 */
export function useTimeAgo(dateStr) {
  const [label, setLabel] = useState(() => computeTimeAgo(dateStr));

  useEffect(() => {
    setLabel(computeTimeAgo(dateStr));
    const interval = setInterval(() => setLabel(computeTimeAgo(dateStr)), 60000);
    return () => clearInterval(interval);
  }, [dateStr]);

  return label;
}