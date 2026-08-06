import { describe, expect, test } from 'vitest';
import {
  emailDomain,
  emailPolicyError,
  isDisposableEmail,
} from '@/lib/emailPolicy';

// The browser-side signup email gate. It is the fast-feedback half of a two-part
// control; the before_user_created database hook enforces the same blocklist so
// a caller that skips this is still refused. These tests pin the format rules
// and the disposable-domain matching, including the subdomain case an attacker
// would reach for.

describe('email format', () => {
  test.each([
    'real@gmail.com',
    'sales@company.co.zw',
    'a.b+tag@sub.domain.example',
    'x@zol.co.zw',
  ])('accepts %s', (email) => {
    expect(emailPolicyError(email)).toBe('');
  });

  test.each([
    ['empty', '', 'Enter your email address'],
    ['no @', 'notanemail', 'Enter a valid email address'],
    ['no domain dot', 'a@localhost', 'Enter a valid email address'],
    ['trailing dot', 'a@domain.', 'Enter a valid email address'],
    ['space in address', 'a b@x.com', 'Enter a valid email address'],
    ['leading dot domain', 'a@.com', 'Enter a valid email address'],
  ])('rejects %s', (_label, email, message) => {
    expect(emailPolicyError(email)).toBe(message);
  });

  test('rejects an over-long address before checking anything else', () => {
    const huge = `${'x'.repeat(250)}@gmail.com`;
    expect(emailPolicyError(huge)).toBe('Email address is too long');
  });

  test('trims surrounding whitespace before validating', () => {
    expect(emailPolicyError('  real@gmail.com  ')).toBe('');
  });
});

describe('disposable domain blocking', () => {
  test.each([
    'bob@mailinator.com',
    'test@guerrillamail.com',
    'x@10minutemail.com',
    'y@yopmail.com',
    'z@temp-mail.org',
  ])('rejects the disposable address %s', (email) => {
    expect(emailPolicyError(email))
      .toBe('Disposable email addresses are not allowed. Use a permanent address.');
    expect(isDisposableEmail(email)).toBe(true);
  });

  test('rejects a subdomain of a disposable domain', () => {
    expect(isDisposableEmail('a@inbox.mailinator.com')).toBe(true);
    expect(isDisposableEmail('a@x.y.guerrillamail.com')).toBe(true);
  });

  test('matching is case-insensitive', () => {
    expect(isDisposableEmail('Bob@MailInator.COM')).toBe(true);
  });

  test('a real domain that merely contains a blocked label is not caught', () => {
    // "mytempmailservice.com" is not "tempmail.com" and must not be blocked by a
    // naive substring match.
    expect(isDisposableEmail('a@mytempmailservice.com')).toBe(false);
    expect(emailPolicyError('a@mytempmailservice.com')).toBe('');
  });

  test('emailDomain extracts the lowercased domain after the last @', () => {
    expect(emailDomain('a@b@Example.COM')).toBe('example.com');
    expect(emailDomain('no-at-sign')).toBe('');
  });
});
