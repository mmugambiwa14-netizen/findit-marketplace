export function assertSmokeTarget(url, testName) {
  const parsedUrl = new URL(url);
  const isLocal = ['127.0.0.1', 'localhost'].includes(parsedUrl.hostname);

  if (isLocal) {
    return {
      label: 'local',
      origin: 'http://127.0.0.1:5173',
    };
  }

  const allowHosted = process.env.FINDIT_ALLOW_HOSTED_SMOKE;
  const expectedProjectRef = process.env.FINDIT_EXPECTED_PROJECT_REF;
  const expectedHostname = expectedProjectRef
    ? `${expectedProjectRef}.supabase.co`
    : null;

  if (
    allowHosted !== 'staging'
    || !expectedProjectRef
    || parsedUrl.protocol !== 'https:'
    || parsedUrl.hostname !== expectedHostname
  ) {
    throw new Error(
      `${testName} refuses to run against a non-local target unless `
      + 'FINDIT_ALLOW_HOSTED_SMOKE=staging and FINDIT_EXPECTED_PROJECT_REF '
      + 'exactly match its HTTPS Supabase URL.',
    );
  }

  return {
    label: 'hosted staging',
    origin: process.env.FINDIT_SMOKE_ORIGIN
      ?? 'https://mmugambiwa14-netizen.github.io',
  };
}
