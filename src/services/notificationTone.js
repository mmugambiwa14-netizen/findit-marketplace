let audioContext = null;
let toneEndAt = 0;
let lastPlayedAt = 0;

function contextConstructor() {
  if (typeof window === 'undefined') return null;
  const browserWindow = /** @type {Window & { webkitAudioContext?: typeof AudioContext }} */ (window);
  return window.AudioContext || browserWindow.webkitAudioContext || null;
}

export async function primeNotificationAudio() {
  const AudioContextConstructor = contextConstructor();
  if (!AudioContextConstructor) return false;
  try {
    audioContext ||= new AudioContextConstructor();
    if (audioContext.state === 'suspended') await audioContext.resume();
    return audioContext.state === 'running';
  } catch {
    return false;
  }
}

export async function playNotificationTone({ enabled = true } = {}) {
  if (!enabled || typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
  const now = Date.now();
  if (now - lastPlayedAt < 1200 || now < toneEndAt) return false;
  if (!(await primeNotificationAudio())) return false;

  try {
    const start = audioContext.currentTime;
    const gain = audioContext.createGain();
    const first = audioContext.createOscillator();
    const second = audioContext.createOscillator();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.055, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    first.type = 'sine';
    second.type = 'sine';
    first.frequency.setValueAtTime(740, start);
    second.frequency.setValueAtTime(988, start + 0.08);
    first.connect(gain);
    second.connect(gain);
    gain.connect(audioContext.destination);
    first.start(start);
    first.stop(start + 0.12);
    second.start(start + 0.08);
    second.stop(start + 0.24);
    lastPlayedAt = now;
    toneEndAt = now + 300;
    return true;
  } catch {
    return false;
  }
}
