import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// The contact-reveal path is the app's main privacy boundary: a public listing
// row carries only has_contact_* booleans, and the actual phone/email/WhatsApp
// value is fetched from a rate-limited RPC after an explicit confirmation, then
// handed straight to the OS. It must never be rendered into the document, and a
// signed-out visitor must never reach the RPC at all.

const mockUseAuth = vi.fn();
const mockRevealContactDetails = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('@/repositories/contactRevealRepository', () => ({
  revealContactDetails: (...args) => mockRevealContactDetails(...args),
}));
vi.mock('sonner', () => ({
  toast: { error: (...args) => mockToastError(...args), success: vi.fn() },
}));

const { default: ContactButtons } = await import('@/components/listings/ContactButtons');

// The guest prompt navigates to the login route, so the component needs router
// context even in the paths that never leave the page.
const render = (ui) => rtlRender(ui, { wrapper: MemoryRouter });

const SELLER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const BUYER_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const LISTING_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

// A public projection: flags only, no values.
const publicListing = (overrides = {}) => ({
  id: LISTING_ID,
  title: 'Three bedroom house in Borrowdale',
  price: 120000,
  status: 'available',
  seller_id: SELLER_ID,
  has_contact_phone: true,
  has_contact_email: true,
  has_contact_whatsapp: true,
  ...overrides,
});

beforeEach(() => {
  mockUseAuth.mockReset();
  mockRevealContactDetails.mockReset();
  mockToastError.mockReset();
  mockUseAuth.mockReturnValue({ user: { id: BUYER_ID } });
});

describe('public projection carries no contact values', () => {
  test('renders without any phone, email or WhatsApp value in the document', () => {
    render(<ContactButtons listing={publicListing()} type="property" />);

    expect(document.body.textContent).not.toMatch(/\+263/);
    expect(document.body.textContent).not.toMatch(/@example\.com/);
    expect(document.body.textContent).not.toMatch(/wa\.me/);
  });

  test('does not call the reveal RPC merely by rendering', () => {
    render(<ContactButtons listing={publicListing()} type="property" />);

    expect(mockRevealContactDetails).not.toHaveBeenCalled();
  });

  test('does not call the reveal RPC just for opening the contact sheet', async () => {
    const user = userEvent.setup();
    render(<ContactButtons listing={publicListing()} type="property" />);

    const trigger = screen.queryAllByRole('button')[0];
    if (trigger) await user.click(trigger);

    expect(mockRevealContactDetails).not.toHaveBeenCalled();
  });
});

describe('signed-out visitors', () => {
  test('a guest never reaches the reveal RPC', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null });

    render(<ContactButtons listing={publicListing()} type="property" />);

    for (const button of screen.queryAllByRole('button')) {
      await user.click(button);
    }

    expect(mockRevealContactDetails).not.toHaveBeenCalled();
  });

  test('a guest is prompted to sign in rather than shown contact details', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null });

    render(<ContactButtons listing={publicListing()} type="property" />);

    const trigger = screen.queryAllByRole('button')[0];
    if (trigger) await user.click(trigger);

    expect(document.body.textContent).not.toMatch(/\+263|@example\.com/);
  });
});

describe('closed enquiries', () => {
  test.each(['sold', 'expired', 'removed', 'paused'])(
    'a %s listing does not offer a contact action',
    (status) => {
      render(<ContactButtons listing={publicListing({ status })} type="property" />);

      expect(screen.getByText('Enquiries closed')).toBeInTheDocument();
    },
  );

  test('a closed listing in the browse placement renders nothing at all', () => {
    const { container } = render(
      <ContactButtons listing={publicListing({ status: 'sold' })} type="property" placement="browse" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('an active listing does offer contact actions', () => {
    render(<ContactButtons listing={publicListing({ status: 'available' })} type="property" />);

    expect(screen.queryByText('Enquiries closed')).not.toBeInTheDocument();
  });

  test('a service uses its own active status rather than the listing statuses', () => {
    render(<ContactButtons listing={publicListing({ status: 'active' })} type="service" />);

    expect(screen.queryByText('Enquiries closed')).not.toBeInTheDocument();
  });

  test('a service with a listing-style status is treated as closed', () => {
    render(<ContactButtons listing={publicListing({ status: 'available' })} type="service" />);

    expect(screen.getByText('Enquiries closed')).toBeInTheDocument();
  });
});

describe('owner projection', () => {
  test('an owner viewing their own listing is not offered the message action', () => {
    mockUseAuth.mockReturnValue({ user: { id: SELLER_ID } });

    render(<ContactButtons listing={publicListing()} type="property" />);

    expect(screen.queryByText(/Message the seller/i)).not.toBeInTheDocument();
  });
});

describe('availability flags drive which actions exist', () => {
  test('a listing with no contact flags offers no external contact method', () => {
    render(
      <ContactButtons
        listing={publicListing({
          has_contact_phone: false,
          has_contact_email: false,
          has_contact_whatsapp: false,
        })}
        type="property"
      />,
    );

    expect(document.body.textContent).not.toMatch(/\+263|@example\.com/);
    expect(mockRevealContactDetails).not.toHaveBeenCalled();
  });
});
