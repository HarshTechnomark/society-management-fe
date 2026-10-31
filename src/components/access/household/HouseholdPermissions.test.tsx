import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { HouseholdPermissions } from './HouseholdPermissions';

const grants = {
  memberId: 1480,
  name: 'Kabir Kulkarni',
  unitIds: [101],
  options: [
    { permissionKey: 'resident.payments.create', label: 'Pay dues', kind: 'ALLOW', enabled: false },
    { permissionKey: 'resident.dues.view', label: 'See dues and statement', kind: 'ALLOW', enabled: true },
    { permissionKey: 'resident.payments.view', label: 'See receipts', kind: 'ALLOW', enabled: true },
    { permissionKey: 'resident.amenities.create', label: 'Book amenities', kind: 'DENY', enabled: true },
    { permissionKey: 'resident.visitors.approve', label: 'Approve visitors', kind: 'DENY', enabled: false },
  ],
};
const route = 'GET /me/household/1480/grants';
const mount = (perms = ['resident.household.view', 'resident.household.edit']) => {
  setMe(sampleMe({ permissions: perms }));
  return render(
    <ToastProvider>
      <HouseholdPermissions memberId={1480} />
    </ToastProvider>,
  );
};

beforeEach(resetAll);

describe('HouseholdPermissions', () => {
  it('shows the toggles with their current state and spec wording', async () => {
    mockApi({ [route]: ok(grants) });
    mount();
    expect(await screen.findByRole('switch', { name: 'See dues and statement' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Pay dues' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Book amenities' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Approve visitors at the gate' })).not.toBeChecked();
  });

  it('saves with one PATCH: allow list from enabled ALLOW options, deny list from disabled DENY options', async () => {
    const api = mockApi({
      [route]: ok(grants),
      'PATCH /me/household/1480/grants': ok(grants),
    });
    mount();
    await userEvent.click(await screen.findByRole('switch', { name: 'Pay dues' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Book amenities' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.last('PATCH', '/me/household/1480/grants')).toBeTruthy());
    expect(api.last('PATCH', '/me/household/1480/grants')?.body).toEqual({
      unitId: 101,
      allow: ['resident.payments.create', 'resident.dues.view', 'resident.payments.view'],
      deny: ['resident.amenities.create', 'resident.visitors.approve'],
    });
    expect(
      await screen.findByText('Saved. Kabir will see this next time the app refreshes.'),
    ).toBeInTheDocument();
  });

  it('is hidden for members who are not family', async () => {
    mockApi({ [route]: err(404, 'MEMBER_NOT_FOUND') });
    mount();
    expect(await screen.findByText(/only available for family members/)).toBeInTheDocument();
  });

  it('shows the save error and is read-only without resident.household.edit', async () => {
    mockApi({ [route]: ok(grants), 'PATCH /me/household/1480/grants': err(403, 'SELF_CHANGE_NOT_ALLOWED') });
    const { unmount } = mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('You cannot change yourself.')).toBeInTheDocument();
    unmount();
    mockApi({ [route]: ok(grants) });
    mount(['resident.household.view']);
    expect(await screen.findByRole('switch', { name: 'Pay dues' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });
});
