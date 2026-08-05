import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The Settings surface is where a user turns two-step verification on and off.
// Enrollment must show a scannable QR plus a manual key, confirm the code, and
// only report "on" once a verified factor exists. Removal must be explicit.

const mockListVerifiedTotpFactors = vi.fn();
const mockEnrollTotpFactor = vi.fn();
const mockVerifyTotpCode = vi.fn();
const mockUnenrollMfaFactor = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/services/authService', () => ({
  listVerifiedTotpFactors: (...args) => mockListVerifiedTotpFactors(...args),
  enrollTotpFactor: (...args) => mockEnrollTotpFactor(...args),
  verifyTotpCode: (...args) => mockVerifyTotpCode(...args),
  unenrollMfaFactor: (...args) => mockUnenrollMfaFactor(...args),
}));
vi.mock('sonner', () => ({
  toast: { success: (...args) => mockToastSuccess(...args), error: (...args) => mockToastError(...args) },
}));

const { default: MfaSettings } = await import('@/components/settings/MfaSettings');

beforeEach(() => {
  vi.clearAllMocks();
});

test('with no factor it offers a set-up control, then enrolls, confirms and reports on', async () => {
  mockListVerifiedTotpFactors.mockResolvedValueOnce([]); // initial load
  mockEnrollTotpFactor.mockResolvedValue({
    factorId: 'new-1',
    qrCode: 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E',
    secret: 'JBSWY3DPEHPK3PXP',
    uri: 'otpauth://totp/FindIt',
  });
  mockVerifyTotpCode.mockResolvedValue({});
  mockListVerifiedTotpFactors.mockResolvedValueOnce([{ id: 'new-1' }]); // refresh after confirm

  render(<MfaSettings />);

  await userEvent.click(await screen.findByRole('button', { name: /set up two-step/i }));

  // The scannable QR and the manual key are both offered.
  expect(await screen.findByRole('img', { name: /qr code/i })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
  expect(screen.getByLabelText(/setup key/i)).toHaveValue('JBSWY3DPEHPK3PXP');

  await userEvent.type(screen.getByLabelText(/code from your app/i), '123456');
  await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

  await waitFor(() => expect(mockVerifyTotpCode).toHaveBeenCalledWith('new-1', '123456'));
  expect(mockToastSuccess).toHaveBeenCalledWith('Two-step verification is on');
  expect(await screen.findByText(/two-step verification is on/i)).toBeInTheDocument();
});

test('a backend that rejects enrollment surfaces an error instead of crashing', async () => {
  mockListVerifiedTotpFactors.mockResolvedValueOnce([]);
  mockEnrollTotpFactor.mockRejectedValue(new Error('mfa disabled'));

  render(<MfaSettings />);
  await userEvent.click(await screen.findByRole('button', { name: /set up two-step/i }));

  await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  // Still on the set-up screen; nothing half-rendered.
  expect(screen.getByRole('button', { name: /set up two-step/i })).toBeInTheDocument();
});

test('an existing factor can be turned off, but only after an explicit confirm', async () => {
  mockListVerifiedTotpFactors.mockResolvedValueOnce([{ id: 'f1', friendly_name: 'FindIt authenticator' }]);
  mockUnenrollMfaFactor.mockResolvedValue(undefined);
  mockListVerifiedTotpFactors.mockResolvedValueOnce([]); // refresh after removal

  render(<MfaSettings />);

  expect(await screen.findByText(/two-step verification is on/i)).toBeInTheDocument();

  // First click only asks for confirmation; nothing is removed yet.
  await userEvent.click(screen.getByRole('button', { name: /turn off two-step verification/i }));
  expect(mockUnenrollMfaFactor).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: /^turn off$/i }));
  await waitFor(() => expect(mockUnenrollMfaFactor).toHaveBeenCalledWith('f1'));
  expect(await screen.findByText(/add two-step verification/i)).toBeInTheDocument();
});
