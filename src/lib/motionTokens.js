export const motionDurations = Object.freeze({
  instant: 90,
  fast: 160,
  standard: 240,
  sheetSettle: 280,
});

export const motionEasings = Object.freeze({
  instant: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
});

export const motionSprings = Object.freeze({
  ui: { responseMs: 240, damping: 1 },
  sheet: { responseMs: 280, damping: 0.88 },
  momentum: { responseMs: 360, damping: 0.82 },
});

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function projectMomentum(velocityPxPerSecond, decelerationRate = 0.998) {
  const rate = Math.min(0.9999, Math.max(0.9, Number(decelerationRate) || 0.998));
  const velocity = Number(velocityPxPerSecond) || 0;
  return (velocity / 1000) * rate / (1 - rate);
}

export function rubberBand(distance, dimension, constant = 0.55) {
  const size = Math.max(1, Number(dimension) || 1);
  const delta = Number(distance) || 0;
  const resistance = Math.max(0.05, Number(constant) || 0.55);
  return (delta * size * resistance) / (size + resistance * Math.abs(delta));
}

export function shouldDismissDrag({ distance, velocity, size }) {
  const dimension = Math.max(1, Number(size) || 1);
  const travel = Math.max(0, Number(distance) || 0);
  const releaseVelocity = Number(velocity) || 0;
  return travel >= Math.min(180, dimension * 0.28) || releaseVelocity >= 850;
}

export function settleElement(element, keyframes, options = {}) {
  if (!element || typeof element.animate !== 'function' || prefersReducedMotion()) return null;
  return element.animate(keyframes, {
    duration: options.duration ?? motionDurations.sheetSettle,
    easing: options.easing ?? motionEasings.emphasized,
    fill: options.fill ?? 'both',
  });
}
