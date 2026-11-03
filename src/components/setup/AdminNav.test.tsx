import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAll } from '@/test/helpers';
import { signIn } from '@/test/setupHelpers';
import { AdminNav, activeHref } from './AdminNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/settings/subscription' }));

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
});
