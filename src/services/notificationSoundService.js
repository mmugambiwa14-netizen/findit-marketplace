const SOUND_KEY = '__peekalisting_notification_sound_enabled';
const MIN_GAP_MS = 1800;
let audioContext = null;
let primed = false;
let lastPlayedAt = 0;

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export function notificationSoundEnabled() {
  const value = storage()?.getItem(SOUND_KEY);
  return value === null ? true : value === '1';
}

export function setNotificationSoundEnabled(enabled) {
  storage()?.setItem(SOUND_KEY, enabled ? '1' : '0');
}

export async function primeNotificationSound() {
  if (primed || typeof window === 'undefined') return;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;
  try {
    audioContext ||= new AudioContextCtor();
    if (audioContext.state === 'suspended') await audioContext.resume();
    primed = audioContext.state === 'running';
  } catch {
    primed = false;
  }
}

export async function playNotificationSound() {
  if (!notificationSoundEnabled()) return false;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return false;
  await primeNotificationSound();
  if (!audioContext || audioContext.state !== 'running') return false;

  try {
    const start = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    gain.connect(audioContext.destination);

    const first = audioContext.createOscillator();
    first.type = 'sine';
    first.frequency.setValueAtTime(660, start);
    first.connect(gain);
    first.start(start);
    first.stop(start + 0.16);

    const second = audioContext.createOscillator();
    second.type = 'sine';
    second.frequency.setValueAtTime(880, start + 0.14);
    second.connect(gain);
    second.start(start + 0.14);
    second.stop(start + 0.34);

    lastPlayedAt = now;
    return true;
  } catch {
    return false;
  }
}
