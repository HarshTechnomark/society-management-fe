import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { myCommitteeRaw, pastCommitteeRaw } from '@/test/committeeFixtures';
import { page } from '@/test/societyFixtures';
import { CommitteeResidentScreen } from './CommitteeResidentScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function show(
  routes: Routes = {},
  perms = ['resident.home.view'],
  features = ['governance.committee_terms'],
) {
  setMe(sampleMe({ permissions: perms, features }));
  const api = mockApi({
    'GET /me/committee': ok(myCommitteeRaw()),
    'GET /files/31/download-url': ok({ url: 'https://files.example/photo.jpg' }),
    ...routes,
  });
  render(
    <ToastProvider>
      <CommitteeResidentScreen />
    </ToastProvider>,
  );
  return api;
}

beforeEach(resetAll);

describe('Resident committee page (11.9)', () => {
  it('shows skeleton rows while loading', async () => {
    show();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    await screen.findByText('Rajesh Kulkarni');
  });

  it('shows the term, designations, masked contact, email link and portfolios', async () => {
    show();
    expect(await screen.findByText('Managing Committee 2024-2029')).toBeInTheDocument();
    const cards = screen.getAllByTestId('committee-member');
    expect(cards[0]).toHaveTextContent('Chairman');
    expect(cards[0]).toHaveTextContent('Flat A-501');
    expect(cards[0]).toHaveTextContent('98XXXXX111');
    expect(within(cards[0]).queryByRole('link', { name: '98XXXXX111' })).toBeNull();
    expect(within(cards[0]).getByRole('link', { name: 'chair@sky.example' })).toHaveAttribute(
      'href',
      'mailto:chair@sky.example',
    );
    expect(cards[0]).toHaveTextContent('Legal');
    expect(cards[1]).toHaveTextContent('Co-opted');
    expect(screen.getByText('1 seat is vacant.')).toBeInTheDocument();
  });

  it('shows the photo when the file URL can be had, else initials', async () => {
    show();
    const card = (await screen.findAllByTestId('committee-member'))[0];
    await vi.waitFor(() => expect(card.querySelector('img')).not.toBeNull());
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://files.example/photo.jpg');
    expect(screen.getAllByTestId('committee-member')[1].querySelector('img')).toBeNull();
  });

  it('keeps initials when the photo URL fails', async () => {
    show({ 'GET /files/31/download-url': err(404, 'FILE_NOT_FOUND') });
    const card = (await screen.findAllByTestId('committee-member'))[0];
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).getByText('RK')).toBeInTheDocument();
  });

  it('says the term ended and the committee is caretaker when overdue', async () => {
    show({
      'GET /me/committee': ok(
        myCommitteeRaw({
          term: {
            name: 'T',
            startDate: '2024-04-01',
            endDate: '2029-03-31',
            status: 'EXPIRED',
            isOverdue: true,
          },
        }),
      ),
    });
    expect(await screen.findByText(/continues as caretaker/)).toBeInTheDocument();
    expect(screen.getByText('Caretaker committee')).toBeInTheDocument();
  });

  it('shows the hidden state', async () => {
    show({ 'GET /me/committee': ok({ visible: false }) });
    expect(await screen.findByText('Your society has not published its committee.')).toBeInTheDocument();
  });

  it('shows the empty state when there is no current committee', async () => {
    show({ 'GET /me/committee': ok({ visible: true, term: null, members: [], vacancies: 0 }) });
    expect(await screen.findByText('Committee details will appear here.')).toBeInTheDocument();
  });

  it('shows an error with the reference, retries and refreshes', async () => {
    const api = show({ 'GET /me/committee': [err(500, 'INTERNAL_ERROR'), ok(myCommitteeRaw())] });
    expect(await screen.findByText('Reference:')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() => expect(api.calls.filter(c => c.path === '/me/committee')).toHaveLength(3));
  });

  it('is locked when the plan has no committee terms', async () => {
    show({}, ['resident.home.view'], []);
    expect(await screen.findByText(/Not (in|available in) your plan/)).toBeInTheDocument();
  });

  it('is closed without resident.home.view', async () => {
    show({}, []);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('lists past committees with the office bearers, and goes back', async () => {
    show({ 'GET /me/committee/history': ok([pastCommitteeRaw()], 'OK', page(1)) });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Past committees' }));
    expect(await screen.findByText('Managing Committee 2019-2024')).toBeInTheDocument();
    expect(screen.getByText(/Old Chair/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to the committee' }));
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
  });

  it('shows the empty and error states of past committees', async () => {
    show({ 'GET /me/committee/history': ok([], 'OK', page(0)) });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Past committees' }));
    expect(await screen.findByText('No past committees yet.')).toBeInTheDocument();
  });

  it('shows an error for past committees', async () => {
    show({ 'GET /me/committee/history': err(500, 'INTERNAL_ERROR') });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Past committees' }));
    expect(await screen.findByText('Reference:')).toBeInTheDocument();
  });
});
