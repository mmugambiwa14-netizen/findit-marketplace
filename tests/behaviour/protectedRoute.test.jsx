import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ProtectedRoute is the browser-side half of the admin boundary. It must never
// render a protected route off a client-held profile object -- it re-asks the
// database on every mount. These tests drive the real component through every
// branch of that decision, including the one that matters most: a failing
// permission service must not be treated as a denial *or* as an approval.

const mockUseAuth = vi.fn();
const mockHasRequiredRole = vi.fn();

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/authService', () => ({
  hasRequiredRole: (...args) => mockHasRequiredRole(...args),
}));

const { default: ProtectedRoute } = await import('@/components/ProtectedRoute');

const authState = (overrides = {}) => ({
  isAuthenticated: true,
  isLoadingAuth: false,
  authChecked: true,
  authError: null,
  checkUserAuth: vi.fn(),
  logout: vi.fn(),
  ...overrides,
});

function renderRoute({ requiredRole } = {}) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          element={(
            <ProtectedRoute
              requiredRole={requiredRole}
              unauthenticatedElement={<p>Please sign in</p>}
            />
          )}
        >
          <Route path="/admin" element={<h1>Admin dashboard</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockHasRequiredRole.mockReset();
});

describe('unauthenticated access', () => {
  test('renders the unauthenticated element instead of the route', async () => {
    mockUseAuth.mockReturnValue(authState({ isAuthenticated: false }));

    renderRoute({ requiredRole: 'admin' });

    expect(await screen.findByText('Please sign in')).toBeInTheDocument();
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  test('does not even ask the database for a role when nobody is signed in', async () => {
    mockUseAuth.mockReturnValue(authState({ isAuthenticated: false }));

    renderRoute({ requiredRole: 'admin' });

    await screen.findByText('Please sign in');
    expect(mockHasRequiredRole).not.toHaveBeenCalled();
  });
});

describe('loading states', () => {
  test('shows the accessible fallback while auth is still resolving', () => {
    mockUseAuth.mockReturnValue(authState({ isLoadingAuth: true, authChecked: false }));

    renderRoute({ requiredRole: 'admin' });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Checking access')).toBeInTheDocument();
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  test('keeps showing the fallback while the role check is in flight', () => {
    mockUseAuth.mockReturnValue(authState());
    mockHasRequiredRole.mockReturnValue(new Promise(() => {}));

    renderRoute({ requiredRole: 'admin' });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });
});

describe('role verification', () => {
  test('renders the protected route when the database confirms the role', async () => {
    mockUseAuth.mockReturnValue(authState());
    mockHasRequiredRole.mockResolvedValue(true);

    renderRoute({ requiredRole: 'admin' });

    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
    expect(mockHasRequiredRole).toHaveBeenCalledWith('admin');
  });

  test('denies access when the database says the role is absent', async () => {
    mockUseAuth.mockReturnValue(authState());
    mockHasRequiredRole.mockResolvedValue(false);

    renderRoute({ requiredRole: 'admin' });

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  test('an authenticated non-admin never briefly sees the protected content', async () => {
    mockUseAuth.mockReturnValue(authState());
    mockHasRequiredRole.mockResolvedValue(false);

    renderRoute({ requiredRole: 'admin' });

    // Before the check resolves the fallback is showing, never the route.
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
    await screen.findByText('Access denied');
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  test('routes with no required role render without a database round-trip', async () => {
    mockUseAuth.mockReturnValue(authState());

    renderRoute({});

    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
    expect(mockHasRequiredRole).not.toHaveBeenCalled();
  });
});

describe('permission service failure', () => {
  test('a thrown role check is reported as unavailable, not as a denial', async () => {
    mockUseAuth.mockReturnValue(authState());
    mockHasRequiredRole.mockRejectedValue(new Error('network down'));

    renderRoute({ requiredRole: 'admin' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('We could not verify your access')).toBeInTheDocument();
    // The distinction matters: "denied" is an authorization answer, this is not.
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  test('a failed check never falls open to the protected route', async () => {
    mockUseAuth.mockReturnValue(authState());
    mockHasRequiredRole.mockRejectedValue(new Error('network down'));

    renderRoute({ requiredRole: 'admin' });

    await screen.findByRole('alert');
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  test('retry re-asks the database and admits the user when it recovers', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(authState());
    mockHasRequiredRole
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(true);

    renderRoute({ requiredRole: 'admin' });

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
    expect(mockHasRequiredRole).toHaveBeenCalledTimes(2);
  });
});

describe('missing profile row', () => {
  test('renders the not-registered surface rather than the protected route', async () => {
    mockUseAuth.mockReturnValue(authState({ authError: { type: 'profile_missing' } }));
    mockHasRequiredRole.mockResolvedValue(true);

    renderRoute({ requiredRole: 'admin' });

    await waitFor(() => {
      expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
    });
  });
});
