import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMe } from '@/lib/auth';
import { mockApi, navigationMock, resetAll, sampleMe } from '@/test/helpers';
import { PlatformShell } from './PlatformShell';

vi.mock('next/navigation', () => navigationMock());

const renderShell = (perms: string[]) => {
  setMe(sampleMe({ platformPermissions: perms }));
  mockApi({});
  render(
    <PlatformShell>
      <p>Page body</p>
    </PlatformShell>,
  );
};

describe('Platform navigation shell', () => {
  beforeEach(resetAll);

  it('links to every screen the person can open, in the prototype groups, and the page body', () => {
    renderShell([
      'platform.dashboard.view',
      'platform.societies.view',
      'platform.plans.view',
      'platform.feature_flags.view',
      'platform.billing.view',
      'platform.jobs.view',
      'platform.tickets.view',
      'platform.health.view',
      'platform.announcements.view',
      'platform.audit_log.view',
      'platform.team.view',
      'platform.settings.view',
    ]);
    const nav = screen.getByRole('navigation', { name: 'Platform' });
    const links = within(nav)
      .getAllByRole('link')
      .map(a => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Dashboard', '/platform'],
      ['Societies', '/platform/societies'],
      ['Organizations', '/platform/organizations'],
      ['Plans', '/platform/plans'],
      ['Feature flags', '/platform/flags'],
      ['Billing', '/platform/billing'],
      ['Jobs and queues', '/platform/jobs'],
      ['Support', '/platform/support'],
      ['Platform health', '/platform/health'],
      ['Announcements', '/platform/announcements'],
      ['Audit trail', '/platform/audit'],
      ['Platform team', '/platform/team'],
      ['Settings', '/platform/settings'],
    ]);
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });

  it('hides screens the person cannot open', () => {
    renderShell(['platform.dashboard.view', 'platform.jobs.view']);
    const nav = screen.getByRole('navigation', { name: 'Platform' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map(a => a.textContent),
    ).toEqual(['Dashboard', 'Jobs and queues']);
    expect(within(nav).queryByText('Governance')).not.toBeInTheDocument();
  });

  it('opens the menu sheet on phones with the same links', async () => {
    renderShell(['platform.dashboard.view', 'platform.health.view']);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = await screen.findByRole('dialog', { name: 'Menu' });
    expect(
      within(sheet)
        .getAllByRole('link')
        .map(a => a.textContent),
    ).toEqual(['Dashboard', 'Platform health']);
    await userEvent.click(within(sheet).getByRole('link', { name: 'Platform health' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
