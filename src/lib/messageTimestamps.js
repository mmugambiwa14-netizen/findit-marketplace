const LOCALE = 'en-TR';

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDifference(date, now = new Date()) {
  return Math.round((startOfLocalDay(now).getTime() - startOfLocalDay(date).getTime()) / 86_400_000);
}

export function formatMessageClock(value) {
  const date = parseTimestamp(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatInboxTimestamp(value, now = new Date()) {
  const date = parseTimestamp(value);
  if (!date) return '';
  const days = dayDifference(date, now);
  if (days === 0) return formatMessageClock(date);
  if (days === 1) return 'Yesterday';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

export function formatMessageDay(value, now = new Date()) {
  const date = parseTimestamp(value);
  if (!date) return '';
  const days = dayDifference(date, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

export function isSameMessageDay(left, right) {
  const first = parseTimestamp(left);
  const second = parseTimestamp(right);
  if (!first || !second) return false;
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}
