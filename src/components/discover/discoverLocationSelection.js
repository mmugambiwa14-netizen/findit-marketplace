export function shouldCommitDiscoverLocationSelection(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.city === 'string'
    && value.city.trim(),
  );
}
