import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureFileUploader } from '@/lib/fileUpload';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import {
  COMMITTEE_FEATURES,
  COMMITTEE_PERMS,
  handoverItemRaw,
  handoverRaw,
  overviewRaw,
  termRaw,
} from '@/test/committeeFixtures';
import { CommitteeTab } from './CommitteeTab';

vi.mock('next/navigation', async () => (await import('@/test/helpers')).navigationMock());

type Routes = Parameters<typeof mockApi>[0];
async function openChecklist(routes: Routes = {}, perms = COMMITTEE_PERMS) {
  setMe(sampleMe({ permissions: perms, features: COMMITTEE_FEATURES }));
  const api = mockApi({
    'GET /committee': ok(overviewRaw()),
    'GET /committee/terms/12': ok(termRaw()),
    'GET /committee/terms/12/handover': ok(handoverRaw()),
    ...routes,
  });
  render(
    <ToastProvider>
      <CommitteeTab />
    </ToastProvider>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Open checklist' }));
  return api;
}

beforeEach(resetAll);
afterEach(() => configureFileUploader(null));

describe('Hand-over checklist (11.6)', () => {
  it('opens from the hand-over bar of the committee card and goes back', async () => {
    await openChecklist();
    expect(await screen.findByText('Insurance papers')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to the committee' }));
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading', async () => {
    setMe(sampleMe({ permissions: COMMITTEE_PERMS, features: COMMITTEE_FEATURES }));
    mockApi({
      'GET /committee': ok(overviewRaw()),
      'GET /committee/terms/12': ok(termRaw()),
      'GET /committee/terms/12/handover': ok(handoverRaw()),
    });
    render(
      <ToastProvider>
        <CommitteeTab />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Open checklist' }));
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    await screen.findByText('Insurance papers');
  });

  it('shows the error with a reference and retries', async () => {
    const api = await openChecklist({
      'GET /committee/terms/12/handover': [err(500, 'INTERNAL_ERROR'), ok(handoverRaw())],
    });
    expect(await screen.findByText('Reference:')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Insurance papers')).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/committee/terms/12/handover')).toHaveLength(2);
  });

  it('shows progress, owners and status in words', async () => {
    await openChecklist();
    await screen.findByText('Insurance papers');
    expect(screen.getByTestId('handover-progress-text')).toHaveTextContent('1 of 3 done');
    expect(screen.getByRole('progressbar', { name: 'Hand-over checklist progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    const rows = screen.getAllByTestId('handover-item');
    expect(rows[0]).toHaveTextContent('Done');
    expect(rows[0]).toHaveTextContent('Owner: Treasurer, Arjun Shah');
    expect(rows[0]).toHaveTextContent('Last updated by Arjun Shah');
    expect(rows[1]).toHaveTextContent('Pending');
  });

  it('shows rows the caller cannot edit as read-only with the reason', async () => {
    await openChecklist();
    await screen.findByText('Insurance papers');
    const row = screen.getAllByTestId('handover-item')[2];
    expect(within(row).queryByLabelText('Status')).toBeNull();
    expect(row).toHaveTextContent('Only the Treasurer or a committee admin can update this');
    expect(within(row).getByText('Policy 2026')).toBeInTheDocument();
  });

  it('marks an item done with a note and sends only the changed fields', async () => {
    const api = await openChecklist({
      'PATCH /committee/terms/12/handover/items/H2': ok(handoverRaw()),
    });
    await screen.findByText('Insurance papers');
    const row = screen.getAllByTestId('handover-item')[1];
    expect(within(row).getByRole('button', { name: 'Save item' })).toBeDisabled();
    await userEvent.selectOptions(within(row).getByLabelText('Status'), 'DONE');
    await userEvent.type(within(row).getByLabelText('Note'), 'Handed to Secretary');
    await userEvent.click(within(row).getByRole('button', { name: 'Save item' }));
    expect(await screen.findByText('Checklist item saved.')).toBeInTheDocument();
    expect(api.last('PATCH', '/committee/terms/12/handover/items/H2')?.body).toEqual({
      status: 'DONE',
      note: 'Handed to Secretary',
    });
  });

  it('asks for the reason when an item does not apply', async () => {
    const api = await openChecklist();
    await screen.findByText('Insurance papers');
    const row = screen.getAllByTestId('handover-item')[1];
    await userEvent.selectOptions(within(row).getByLabelText('Status'), 'NOT_APPLICABLE');
    await userEvent.click(within(row).getByRole('button', { name: 'Save item' }));
    expect(await within(row).findByText(/Say why this item does not apply/)).toBeInTheDocument();
    expect(api.last('PATCH', '/committee/terms/12/handover/items/H2')).toBeUndefined();
  });

  it('shows the server message when the save is refused', async () => {
    await openChecklist({
      'PATCH /committee/terms/12/handover/items/H2': err(403, 'PERMISSION_DENIED'),
    });
    await screen.findByText('Insurance papers');
    const row = screen.getAllByTestId('handover-item')[1];
    await userEvent.selectOptions(within(row).getByLabelText('Status'), 'DONE');
    await userEvent.click(within(row).getByRole('button', { name: 'Save item' }));
    expect(await within(row).findByText('You do not have permission to do this.')).toBeInTheDocument();
  });

  it('uploads evidence with the HANDOVER_EVIDENCE purpose and links the file id', async () => {
    const upload = vi.fn().mockResolvedValue({ fileId: 77 });
    configureFileUploader({ upload });
    const api = await openChecklist({
      'PATCH /committee/terms/12/handover/items/H2': ok(handoverRaw()),
    });
    await screen.findByText('Insurance papers');
    const row = screen.getAllByTestId('handover-item')[1];
    const file = new File(['x'], 'receipt.pdf', { type: 'application/pdf' });
    await userEvent.upload(within(row).getByLabelText(/Add evidence/), file);
    expect(upload).toHaveBeenCalledWith(file, 'HANDOVER_EVIDENCE');
    expect(await within(row).findByRole('button', { name: 'Open evidence 1' })).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Save item' }));
    await screen.findByText('Checklist item saved.');
    expect(api.last('PATCH', '/committee/terms/12/handover/items/H2')?.body).toEqual({
      evidenceFileIds: [77],
    });
  });

  it('adds an item with an owner designation', async () => {
    const api = await openChecklist({
      'POST /committee/terms/12/handover/items': ok(handoverRaw()),
    });
    await screen.findByText('Insurance papers');
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    const form = await screen.findByRole('form', { name: 'Add checklist item' });
    await userEvent.click(within(form).getByRole('button', { name: 'Add to checklist' }));
    expect(await within(form).findByText(/Enter a title of 3 to 120 characters/)).toBeInTheDocument();
    await userEvent.type(within(form).getByLabelText('Title'), 'Water tank keys');
    await userEvent.selectOptions(within(form).getByLabelText('Owner'), 'SECRETARY');
    await userEvent.click(within(form).getByRole('button', { name: 'Add to checklist' }));
    expect(await screen.findByText('Item added.')).toBeInTheDocument();
    expect(api.last('POST', '/committee/terms/12/handover/items')?.body).toEqual({
      title: 'Water tank keys',
      ownerDesignation: 'SECRETARY',
    });
  });

  it('hides Add item without settings.members.edit and shows an empty checklist', async () => {
    await openChecklist(
      {
        'GET /committee/terms/12/handover': ok(
          handoverRaw({ items: [], progress: { total: 0, done: 0, notApplicable: 0, pending: 0 } }),
        ),
      },
      ['settings.members.view'],
    );
    expect(await screen.findByText('No checklist items yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
  });

  it('shows the completion chip when every item is resolved', async () => {
    await openChecklist({
      'GET /committee/terms/12/handover': ok(
        handoverRaw({
          completedAt: '2026-10-05T00:00:00.000Z',
          progress: { total: 1, done: 1, notApplicable: 0, pending: 0 },
          items: [handoverItemRaw({ status: 'DONE', canEdit: false })],
        }),
      ),
    });
    expect(await screen.findByText(/Complete on/)).toBeInTheDocument();
  });
});
