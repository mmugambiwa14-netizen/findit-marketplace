const baseUrl = (
  process.env.FINDIT_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/+$/, '');
const publishableKey =
  process.env.FINDIT_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!baseUrl || !publishableKey) {
  console.error(
    'Set FINDIT_SUPABASE_URL and FINDIT_SUPABASE_ANON_KEY before verifying OAuth providers.',
  );
  process.exit(1);
}

const response = await fetch(`${baseUrl}/auth/v1/settings`, {
  headers: { apikey: publishableKey },
});

if (!response.ok) {
  console.error(`Supabase Auth settings request failed with HTTP ${response.status}.`);
  process.exit(1);
}

const settings = await response.json();
const actual = {
  google: settings.external?.google === true,
  apple: settings.external?.apple === true,
};
const expected = {
  google: process.env.FINDIT_EXPECT_GOOGLE_OAUTH,
  apple: process.env.FINDIT_EXPECT_APPLE_OAUTH,
};
const problems = [];

for (const [provider, rawExpected] of Object.entries(expected)) {
  if (rawExpected === undefined || rawExpected === '') continue;
  if (!['true', 'false'].includes(rawExpected)) {
    problems.push(`FINDIT_EXPECT_${provider.toUpperCase()}_OAUTH must be true or false`);
    continue;
  }
  if (actual[provider] !== (rawExpected === 'true')) {
    problems.push(
      `${provider} expected ${rawExpected} but Supabase reports ${actual[provider]}`,
    );
  }
}

console.log(JSON.stringify({ status: problems.length ? 'failed' : 'passed', providers: actual }));

if (problems.length) {
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
