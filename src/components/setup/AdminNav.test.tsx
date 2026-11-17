import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAll } from '@/test/helpers';
import { signIn } from '@/test/setupHelpers';
import { AdminNav, activeHref } from './AdminNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings/subscription',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), // the switch-app button navigates after switching
}));

describe('Admin navigation', () => {
  beforeEach(resetAll);

  it('links to the setup pages the person may open', () => {
    signIn(['settings.society.view', 'residents.units.view']);
    render(
      <AdminNav>
        <p>content</p>
      </AdminNav>,
    );
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    for (const name of [
      'Set up your society',
      'Society profile',
      'Buildings',
      'Flats',
      'Locations',
      'Holidays',
      'Settings',
      'Help and support',
    ])
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Team' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Subscription' })).not.toBeInTheDocument();
  });

  it('hides Flats and Buildings without residents.units.view', () => {
    signIn(['settings.society.view']);
    render(<AdminNav>x</AdminNav>);
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).queryByRole('link', { name: 'Flats' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Holidays' })).toBeInTheDocument();
  });

  it('names the two opening pages differently', () => {
    signIn(['settings.society.view', 'finance.billing.view', 'finance.accounts.view']);
    render(<AdminNav>x</AdminNav>);
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: 'Opening arrears' })).toHaveAttribute(
      'href',
      '/admin/settings/billing/opening-balances',
    );
    expect(within(nav).getAllByRole('link', { name: 'Opening balances' })).toHaveLength(1);
    expect(within(nav).getByRole('link', { name: 'Opening balances' })).toHaveAttribute(
      'href',
      '/admin/accounts/opening-balances',
    );
  });

  it('shows the account pages by permission and marks the most specific page current', () => {
    signIn([
      'settings.subscription.view',
      'settings.support_access.view',
      'settings.data_export.view',
      'settings.society.view',
      'settings.audit_log.view',
      'settings.members.view',
      'settings.roles.view',
    ]);
    render(<AdminNav>x</AdminNav>);
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: 'Subscription' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
    for (const name of ['Team', 'Roles', 'Support access', 'Data export', 'Audit trail'])
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
  });

  it('opens the menu on phones with the same links', async () => {
    signIn(['settings.society.view']);
    render(<AdminNav>x</AdminNav>);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = await screen.findByRole('navigation', { name: 'Admin menu' });
    expect(within(menu).getByRole('link', { name: 'Holidays' })).toBeInTheDocument();
  });

  it('picks the longest matching link', () => {
    expect(activeHref('/admin/settings')).toBe('/admin/settings');
    expect(activeHref('/admin/settings/data-export')).toBe('/admin/settings/data-export');
    expect(activeHref('/admin/roles/5')).toBe('/admin/roles');
    expect(activeHref('/admin')).toBeNull();
  });

  it('shows Billing runs only with finance.billing.view', () => {
    signIn(['settings.society.view']);
    const { unmount } = render(<AdminNav>x</AdminNav>);
    expect(
      within(screen.getByRole('navigation', { name: 'Admin' })).queryByRole('link', { name: 'Billing runs' }),
    ).not.toBeInTheDocument();
    unmount();
    signIn(['finance.billing.view']);
    render(<AdminNav>x</AdminNav>);
    expect(
      within(screen.getByRole('navigation', { name: 'Admin' })).getByRole('link', { name: 'Billing runs' }),
    ).toHaveAttribute('href', '/admin/billing/runs');
  });
  it('shows the Money links by finance.payments.view and finance.collections.view', () => {
    signIn(['settings.society.view']);
    const { unmount } = render(<AdminNav>x</AdminNav>);
    const nav = () => within(screen.getByRole('navigation', { name: 'Admin' }));
    expect(nav().queryByRole('link', { name: 'Payments' })).not.toBeInTheDocument();
    expect(nav().queryByRole('link', { name: 'Collections' })).not.toBeInTheDocument();
    unmount();
    signIn(['finance.collections.view']);
    const second = render(<AdminNav>x</AdminNav>);
    expect(nav().getByRole('link', { name: 'Collections' })).toHaveAttribute('href', '/admin/collections');
    expect(nav().queryByRole('link', { name: 'Payments' })).not.toBeInTheDocument();
    second.unmount();
    signIn(['finance.payments.view'], ['payments.payment_links', 'payments.upi_autopay_mandates']);
    render(<AdminNav>x</AdminNav>);
    expect(nav().getByRole('link', { name: 'Payments' })).toHaveAttribute('href', '/admin/payments');
    expect(nav().getByRole('link', { name: 'Payment links' })).toBeInTheDocument();
    expect(nav().getByRole('link', { name: 'AutoPay' })).toBeInTheDocument();
  });

  it('hides (not greys) Payment links and AutoPay on a plan without them', () => {
    signIn(['finance.payments.view'], ['payments.receipts']);
    render(<AdminNav>x</AdminNav>);
    const nav = within(screen.getByRole('navigation', { name: 'Admin' }));
    expect(nav.getByRole('link', { name: 'Payments' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Payment links' })).toBeNull();
    expect(nav.queryByRole('link', { name: 'AutoPay' })).toBeNull();
  });
  it('shows the Accounts links by finance.accounts.view, finance.expenses.view and finance.bank.view', () => {
    signIn(['settings.society.view']);
    const { unmount } = render(<AdminNav>x</AdminNav>);
    const nav = () => within(screen.getByRole('navigation', { name: 'Admin' }));
    expect(nav().queryByRole('link', { name: 'Society balance' })).not.toBeInTheDocument();
    unmount();
    signIn(['finance.expenses.view']);
    const second = render(<AdminNav>x</AdminNav>);
    expect(nav().getByRole('link', { name: 'Expenses' })).toHaveAttribute('href', '/admin/accounts/expenses');
    expect(nav().getByRole('link', { name: 'Cash book' })).toBeInTheDocument();
    expect(nav().queryByRole('link', { name: 'Journals' })).not.toBeInTheDocument();
    second.unmount();
    signIn(['finance.accounts.view', 'finance.bank.view']);
    render(<AdminNav>x</AdminNav>);
    for (const name of ['Society balance', 'Funds', 'Journals', 'Reports', 'Bank accounts', 'Settlements'])
      expect(nav().getByRole('link', { name })).toBeInTheDocument();
  });
});
