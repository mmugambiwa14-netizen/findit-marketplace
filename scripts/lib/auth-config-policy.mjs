const BOOLEAN_TEXT = new Map([
  ['true', true],
  ['false', false],
]);

function firstField(config, names) {
  for (const name of names) {
    if (Object.hasOwn(config, name)) {
      return { present: true, key: name, value: config[name] };
    }
  }
  return { present: false, key: names[0], value: undefined };
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return BOOLEAN_TEXT.get(value.trim().toLowerCase());
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1;
  return undefined;
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new URL(value.trim());
  if (parsed.pathname === '/') parsed.pathname = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function normalizeUrlList(value) {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(entries
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map(normalizeUrl))]
    .sort();
}

function normalizeRequiredCharacters(value) {
  if (typeof value !== 'string') return '';
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

function readExpectedBoolean(environment, name, problems, required) {
  const raw = environment[name];
  if (raw === undefined || raw === '') {
    if (required) problems.push(`${name} is required for production Auth certification`);
    return undefined;
  }
  const parsed = BOOLEAN_TEXT.get(String(raw).trim().toLowerCase());
  if (parsed === undefined) problems.push(`${name} must be true or false`);
  return parsed;
}

function readExpectedInteger(environment, name, problems, required) {
  const raw = environment[name];
  if (raw === undefined || raw === '') {
    if (required) problems.push(`${name} is required for production Auth certification`);
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    problems.push(`${name} must be a positive integer`);
    return undefined;
  }
  return parsed;
}

function compareBoolean({ config, keys, expected, label, problems, summary }) {
  const field = firstField(config, keys);
  const actual = toBoolean(field.value);
  summary[label] = actual ?? null;
  if (expected === undefined) return;
  if (!field.present || actual === undefined) {
    problems.push(`${label} could not be verified because ${keys.join(' or ')} was not returned`);
  } else if (actual !== expected) {
    problems.push(`${label} expected ${expected} but Supabase reports ${actual}`);
  }
}

export function evaluateHostedAuthConfig(config, environment = process.env) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Supabase Auth configuration must be an object.');
  }

  const mode = environment.FINDIT_AUTH_PREFLIGHT_MODE ?? 'audit';
  if (!['audit', 'staging', 'production'].includes(mode)) {
    throw new Error('FINDIT_AUTH_PREFLIGHT_MODE must be audit, staging, or production.');
  }
  const production = mode === 'production';
  const problems = [];
  const summary = { mode };

  const siteUrlExpectedRaw = environment.FINDIT_EXPECT_AUTH_SITE_URL;
  if (production && !siteUrlExpectedRaw) {
    problems.push('FINDIT_EXPECT_AUTH_SITE_URL is required for production Auth certification');
  }
  const siteUrlField = firstField(config, ['site_url']);
  const actualSiteUrl = siteUrlField.present && siteUrlField.value
    ? normalizeUrl(siteUrlField.value)
    : '';
  summary.siteUrlConfigured = Boolean(actualSiteUrl);
  if (siteUrlExpectedRaw) {
    const expectedSiteUrl = normalizeUrl(siteUrlExpectedRaw);
    if (!actualSiteUrl) problems.push('Auth site URL is not configured');
    else if (actualSiteUrl !== expectedSiteUrl) {
      problems.push('Auth site URL does not match FINDIT_EXPECT_AUTH_SITE_URL');
    }
  }
  if (production && actualSiteUrl && new URL(actualSiteUrl).protocol !== 'https:') {
    problems.push('Production Auth site URL must use HTTPS');
  }

  const redirectsExpectedRaw = environment.FINDIT_EXPECT_AUTH_REDIRECT_URLS;
  if (production && !redirectsExpectedRaw) {
    problems.push('FINDIT_EXPECT_AUTH_REDIRECT_URLS is required for production Auth certification');
  }
  const redirectsField = firstField(config, ['uri_allow_list', 'additional_redirect_urls']);
  const actualRedirects = normalizeUrlList(redirectsField.value);
  summary.redirectUrlCount = actualRedirects.length;
  if (redirectsExpectedRaw) {
    const expectedRedirects = normalizeUrlList(redirectsExpectedRaw);
    if (JSON.stringify(actualRedirects) !== JSON.stringify(expectedRedirects)) {
      problems.push('Auth redirect allow list does not exactly match FINDIT_EXPECT_AUTH_REDIRECT_URLS');
    }
  }
  if (production) {
    for (const redirect of actualRedirects) {
      const parsed = new URL(redirect);
      if (parsed.protocol !== 'https:') problems.push('Every production Auth redirect URL must use HTTPS');
      if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
        problems.push('Production Auth redirect URLs must not include loopback hosts');
      }
    }
  }

  const confirmationsExpected = readExpectedBoolean(
    environment,
    'FINDIT_EXPECT_EMAIL_CONFIRMATIONS',
    problems,
    production,
  );
  const autoConfirmField = firstField(config, ['mailer_autoconfirm']);
  const autoConfirm = toBoolean(autoConfirmField.value);
  const confirmationsActual = autoConfirm === undefined ? undefined : !autoConfirm;
  summary.emailConfirmations = confirmationsActual ?? null;
  if (confirmationsExpected !== undefined) {
    if (!autoConfirmField.present || confirmationsActual === undefined) {
      problems.push('email confirmations could not be verified because mailer_autoconfirm was not returned');
    } else if (confirmationsActual !== confirmationsExpected) {
      problems.push(`email confirmations expected ${confirmationsExpected} but Supabase reports ${confirmationsActual}`);
    }
  }

  const expectedMinimumLength = readExpectedInteger(
    environment,
    'FINDIT_EXPECT_PASSWORD_MIN_LENGTH',
    problems,
    production,
  );
  const passwordLengthField = firstField(config, ['password_min_length']);
  const actualMinimumLength = Number(passwordLengthField.value);
  summary.passwordMinimumLength = Number.isFinite(actualMinimumLength) ? actualMinimumLength : null;
  if (expectedMinimumLength !== undefined) {
    if (!passwordLengthField.present || !Number.isFinite(actualMinimumLength)) {
      problems.push('password minimum length could not be verified');
    } else if (actualMinimumLength < expectedMinimumLength) {
      problems.push(`password minimum length must be at least ${expectedMinimumLength}`);
    }
  }

  const expectedRequiredCharactersRaw = environment.FINDIT_EXPECT_PASSWORD_REQUIRED_CHARACTERS;
  if (production && !expectedRequiredCharactersRaw) {
    problems.push('FINDIT_EXPECT_PASSWORD_REQUIRED_CHARACTERS is required for production Auth certification');
  }
  const requiredCharactersField = firstField(config, ['password_required_characters']);
  const actualRequiredCharacters = normalizeRequiredCharacters(requiredCharactersField.value);
  summary.passwordRequiredCharactersConfigured = Boolean(actualRequiredCharacters);
  if (expectedRequiredCharactersRaw) {
    const expectedRequiredCharacters = normalizeRequiredCharacters(expectedRequiredCharactersRaw);
    if (!requiredCharactersField.present) {
      problems.push('password required characters could not be verified');
    } else if (actualRequiredCharacters !== expectedRequiredCharacters) {
      problems.push('password required characters do not match FINDIT_EXPECT_PASSWORD_REQUIRED_CHARACTERS');
    }
  }

  compareBoolean({
    config,
    keys: ['password_hibp_enabled'],
    expected: readExpectedBoolean(environment, 'FINDIT_EXPECT_LEAKED_PASSWORD_PROTECTION', problems, production),
    label: 'leakedPasswordProtection',
    problems,
    summary,
  });

  const expectedTotp = readExpectedBoolean(environment, 'FINDIT_EXPECT_TOTP_MFA', problems, production);
  const totpEnroll = firstField(config, ['mfa_totp_enroll_enabled']);
  const totpVerify = firstField(config, ['mfa_totp_verify_enabled']);
  const totpActual = toBoolean(totpEnroll.value) === true && toBoolean(totpVerify.value) === true;
  summary.totpMfa = totpEnroll.present && totpVerify.present ? totpActual : null;
  if (expectedTotp !== undefined) {
    if (!totpEnroll.present || !totpVerify.present) {
      problems.push('TOTP MFA could not be verified because enrollment or verification fields were not returned');
    } else if (totpActual !== expectedTotp) {
      problems.push(`TOTP MFA expected ${expectedTotp} but Supabase reports ${totpActual}`);
    }
  }

  compareBoolean({
    config,
    keys: ['security_captcha_enabled'],
    expected: readExpectedBoolean(environment, 'FINDIT_EXPECT_AUTH_CAPTCHA', problems, production),
    label: 'captchaProtection',
    problems,
    summary,
  });
  compareBoolean({
    config,
    keys: ['external_google_enabled'],
    expected: readExpectedBoolean(environment, 'FINDIT_EXPECT_GOOGLE_OAUTH', problems, production),
    label: 'googleOAuth',
    problems,
    summary,
  });
  compareBoolean({
    config,
    keys: ['external_apple_enabled'],
    expected: readExpectedBoolean(environment, 'FINDIT_EXPECT_APPLE_OAUTH', problems, production),
    label: 'appleOAuth',
    problems,
    summary,
  });
  compareBoolean({
    config,
    keys: ['external_anonymous_users_enabled', 'external_anonymous_enabled'],
    expected: readExpectedBoolean(environment, 'FINDIT_EXPECT_ANONYMOUS_AUTH', problems, production),
    label: 'anonymousAuth',
    problems,
    summary,
  });
  compareBoolean({
    config,
    keys: ['external_phone_enabled', 'sms_enabled'],
    expected: readExpectedBoolean(environment, 'FINDIT_EXPECT_PHONE_SIGNUP', problems, production),
    label: 'phoneSignup',
    problems,
    summary,
  });

  const expectedCustomSmtp = readExpectedBoolean(environment, 'FINDIT_EXPECT_CUSTOM_SMTP', problems, production);
  const smtpHost = firstField(config, ['smtp_host']);
  const smtpSender = firstField(config, ['smtp_admin_email', 'smtp_sender_name']);
  const customSmtpActual = Boolean(
    typeof smtpHost.value === 'string'
      && smtpHost.value.trim()
      && typeof smtpSender.value === 'string'
      && smtpSender.value.trim(),
  );
  summary.customSmtp = smtpHost.present && smtpSender.present ? customSmtpActual : null;
  if (expectedCustomSmtp !== undefined) {
    if (!smtpHost.present || !smtpSender.present) {
      problems.push('custom SMTP could not be verified because SMTP host or sender fields were not returned');
    } else if (customSmtpActual !== expectedCustomSmtp) {
      problems.push(`custom SMTP expected ${expectedCustomSmtp} but Supabase reports ${customSmtpActual}`);
    }
  }

  return {
    status: problems.length ? 'failed' : 'passed',
    problems,
    summary,
  };
}
