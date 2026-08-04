import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowError, userFacingError } from '../src/lib/userFacingErrors.js';

test('hides database and API details', () => {
  const message = userFacingError(
    new Error('PostgREST PGRST116: duplicate key violates constraint listings_submission_key'),
    'We could not save this listing. Please try again.',
  );
  assert.equal(message, 'This has already been added.');
  assert.doesNotMatch(message, /postgrest|constraint|PGRST/i);
});

test('gives clear authentication guidance', () => {
  assert.equal(userFacingError(new Error('Invalid login credentials')), 'The email or password is incorrect.');
  assert.equal(userFacingError(new Error('Email not confirmed')), 'Confirm your email address before logging in.');
});

test('gives clear connectivity and upload guidance', () => {
  assert.equal(userFacingError(new Error('TypeError: Failed to fetch')), 'Check your internet connection and try again.');
  assert.equal(userFacingError(new Error('storage upload failed with status code 503')), 'The upload did not finish. Check your connection and try again.');
});

test('suppresses background cancellation noise', () => {
  assert.equal(shouldShowError(new Error('AbortError: stale request cancelled')), false);
  assert.equal(shouldShowError(new Error('Could not save')), true);
});
