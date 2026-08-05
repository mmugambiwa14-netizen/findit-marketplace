import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// The step-up screen is what actually stops a password-only session from
// reaching the app once a factor is enrolled. It must verify the entered code
// against the user's factor and only then release the app, and it must never
// release it on a wrong code.

const mockListVerifiedTotpFactors = vi.fn();
const mockVerifyTotpCode = vi.fn();
const mockLogout = vi.fn();

vi.mock('@/services/authService', () => ({
  listVerifiedTotpFactors: (...args) => mockListVerifiedTotpFactors(...args),
  verifyTotpCode: (...args) => mockVerifyTotpCode(...args),
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ logout: mockLogout }) }));

const { default: MfaChallengeScreen } = await import('@/components/auth/MfaChallengeScreen');

const render = (ui) => rtlRender(ui, { wrapper: MemoryRouter });

beforeEach(() => {
  vi.clearAllMocks();
});

test('a correct code verifies against the loaded factor and releases the app', async () => {
  mockListVerifiedTotpFactors.mockResolvedValue([{ id: 'factor-1', friendly_name: 'FindIt authenticator' }]);
  mockVerifyTotpCode.mockResolvedValue({});
  const onVerified = vi.fn();

  render(<MfaChallengeScreen onVerified={onVerified} />);

  const input = await screen.findByLabelText(/authentication code/i);
  await userEvent.type(input, '123456');
  await userEvent.click(screen.getByRole('button', { name: /verify/i }));

  await waitFor(() => expect(mockVerifyTotpCode).toHaveBeenCalledWith('factor-1', '123456'));
  expect(onVerified).toHaveBeenCalledTimes(1);
});

test('a wrong code shows an error and does not release the app', async () => {
  mockListVerifiedTotpFactors.mockResolvedValue([{ id: 'factor-1' }]);
  mockVerifyTotpCode.mockRejectedValue(new Error('Invalid one-time code'));
  const onVerified = vi.fn();

  render(<MfaChallengeScreen onVerified={onVerified} />);

  const input = await screen.findByLabelText(/authentication code/i);
  await userEvent.type(input, '000000');
  await userEvent.click(screen.getByRole('button', { name: /verify/i }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(onVerified).not.toHaveBeenCalled();
  // The field is cleared so the next attempt starts fresh.
  expect(input).toHaveValue('');
});

test('non-digits are stripped so only a numeric code is submitted', async () => {
  mockListVerifiedTotpFactors.mockResolvedValue([{ id: 'factor-1' }]);
  mockVerifyTotpCode.mockResolvedValue({});
  const onVerified = vi.fn();

  render(<MfaChallengeScreen onVerified={onVerified} />);
  const input = await screen.findByLabelText(/authentication code/i);
  await userEvent.type(input, '12ab34cd56');

  expect(input).toHaveValue('123456');
});

test('when no factor can be loaded it fails safe with a sign-out, not a silent pass', async () => {
  mockListVerifiedTotpFactors.mockResolvedValue([]);
  const onVerified = vi.fn();

  render(<MfaChallengeScreen onVerified={onVerified} />);

  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(onVerified).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /^sign out$/i }));
  expect(mockLogout).toHaveBeenCalled();
});
