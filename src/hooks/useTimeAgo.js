import { useState, useEffect } from "react";

const LOCALE = 'en-TR';

function exactLabel(date, includeDate = false) {
  return new Intl.DateTimeFormat(LOCALE, includeDate
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

function computeTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const normalized = /[Z+\-]\d*$/.test(dateStr.trim()) ? dateStr : dateStr + "Z";
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "";
  const diffMs = now - date.getTime();
  if (diffMs < 0) return `Just now · ${exactLabel(date)}`;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return `Just now · ${exactLabel(date)}`;
  if (diffMins < 60) return `${diffMins}m ago · ${exactLabel(date)}`;
  if (diffHours < 24) return `${diffHours}h ago · ${exactLabel(date)}`;
  if (diffDays < 7) return `${diffDays}d ago · ${exactLabel(date, true)}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago · ${exactLabel(date, true)}`;
  return `${Math.floor(diffDays / 30)}mo ago · ${exactLabel(date, true)}`;
}

export function useTimeAgo(dateStr) {
  const [label, setLabel] = useState(() => computeTimeAgo(dateStr));

  useEffect(() => {
    setLabel(computeTimeAgo(dateStr));
    const interval = setInterval(() => setLabel(computeTimeAgo(dateStr)), 60000);
    return () => clearInterval(interval);
  }, [dateStr]);

  return label;
}
