import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { ToastProvider } from '@/components/ui/Toast';
import {
  RESIDENT_COMM_PERMS,
  noticeDetailRaw,
  noticeRaw,
  surveyRaw,
} from '@/test/communicationResidentFixtures';
import type { SurveyQuestion } from '@/types/residentNotices';
import { safeHtml } from './safeHtml';
import { NoticeBoardScreen } from './resident/NoticeBoardScreen';
import { NoticeDetailScreen } from './resident/NoticeDetailScreen';
import { SurveyScreen, answerFor, problemFor } from './resident/SurveyScreen';
import { actionHref } from './resident/format';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

type Routes = Parameters<typeof mockApi>[0];
function show(ui: React.ReactElement, routes: Routes, perms = RESIDENT_COMM_PERMS, features: string[] = []) {
  signInAs(perms, features);
  const api = mockApi(routes);
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}
const page = { page: 1, limit: 20, total: 1, totalPages: 1 };

describe('safeHtml and links', () => {
  it('drops scripts, handlers and unsafe links but keeps formatting', () => {
    const out = safeHtml(
      '<p>Hi <strong>all</strong></p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">bad</a><a href="https://e.in">ok</a>',
    );
    expect(out).toContain('<strong>all</strong>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="https://e.in"');
  });
  it('maps action targets', () => {
    expect(actionHref({ type: 'PAY_COLLECTION', refId: 2, url: null })).toBe('/resident/pay/collections/2');
    expect(actionHref({ type: 'PAY_DUES', refId: null, url: null })).toBe('/resident/bills');
  });
});

describe('Notice board', () => {
  it('shows pinned, unread, Ack required and open surveys, and searches only from 2 letters', async () => {
    const api = show(<NoticeBoardScreen />, {
      'GET /me/notices': ok([noticeRaw({ id: 1, isPinned: true, title: 'Pinned AGM' }), noticeRaw()], 'OK', {
        pagination: page,
      }),
      'GET /me/surveys': ok([
        {
          id: 9,
          title: 'Gym timings',
          closesAt: '2026-12-01T10:00:00.000Z',
          questionCount: 3,
          responded: false,
          resultsAvailable: false,
        },
      ]),
    });
    expect(await screen.findByText('Water cut Tower A, Saturday')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pinned notices' })).toHaveTextContent('Pinned AGM');
    expect(screen.getByText('Ack required')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gym timings/ })).toHaveAttribute('href', '/resident/surveys/9');
    await userEvent.type(screen.getByLabelText('Search notices'), 'w');
    expect(api.calls.filter(c => c.path === '/me/notices')).toHaveLength(1);
    await userEvent.type(screen.getByLabelText('Search notices'), 'a');
    await waitFor(() => expect(api.calls.filter(c => c.path === '/me/notices')).toHaveLength(2));
    const urls = api.fn.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes('/me/notices') && u.includes('q=wa'))).toBe(true);
  });
  it('is hidden without the view permission', async () => {
    show(<NoticeBoardScreen />, {}, ['resident.home.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
  it('still works when surveys are not in the plan (402)', async () => {
    show(<NoticeBoardScreen />, {
      'GET /me/notices': ok([noticeRaw()], 'OK', { pagination: page }),
      'GET /me/surveys': err(402, 'FEATURE_NOT_IN_PLAN'),
    });
    expect(await screen.findByText('Water cut Tower A, Saturday')).toBeInTheDocument();
    expect(screen.queryByText('Surveys for you')).toBeNull();
  });
});

describe('Notice detail', () => {
  const routes = (over: Routes = {}): Routes => ({ 'GET /me/notices/412': ok(noticeDetailRaw()), ...over });
  it('renders sanitised text, live action states and acknowledges once', async () => {
    const api = show(
      <NoticeDetailScreen id={412} />,
      routes({
        'POST /me/notices/412/acknowledge': ok({
          noticeId: 412,
          acknowledgedAt: '2026-11-18T10:00:00.000Z',
          revisionNo: 1,
        }),
      }),
    );
    expect(await screen.findByText('Please store water.')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('link', { name: 'Pay ₹1,100' })).toHaveAttribute(
      'href',
      '/resident/pay/collections/2',
    );
    expect(screen.getByText('Paid · RCT/2026-27/000046')).toBeInTheDocument();
    expect(screen.getByText('No longer open')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I have read and understood' }));
    await waitFor(() => expect(api.last('POST', '/me/notices/412/acknowledge')).toBeTruthy());
    expect(await screen.findByText(/You acknowledged this on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I have read and understood' })).toBeNull();
  });
  it('opens an attachment through the download url', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    show(
      <NoticeDetailScreen id={412} />,
      routes({ 'GET /me/notices/412/attachments/9031/download-url': ok({ url: 'https://files.test/x' }) }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'schedule.pdf' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files.test/x', '_blank', 'noopener'));
  });
  it('shows an already-acknowledged notice, the utility card and no ack button for view-only residents', async () => {
    show(<NoticeDetailScreen id={412} />, {
      'GET /me/notices/412': ok(
        noticeDetailRaw({
          acknowledgedAt: '2026-11-17T10:00:00.000Z',
          kind: 'UTILITY_SHUTDOWN',
          utility: {
            type: 'WATER',
            startsAt: '2026-11-21T04:30:00.000Z',
            endsAt: '2026-11-21T08:30:00.000Z',
            restoredAt: '2026-11-21T08:00:00.000Z',
          },
        }),
      ),
    });
    expect(await screen.findByLabelText('Utility shutdown')).toHaveTextContent('Water supply shutdown');
    expect(screen.getByText(/Restored/)).toBeInTheDocument();
    expect(screen.getByText(/You acknowledged this on/)).toBeInTheDocument();
  });
  it('shows not found with a way back', async () => {
    show(<NoticeDetailScreen id={9} />, { 'GET /me/notices/9': err(404, 'NOTICE_NOT_FOUND') });
    expect(await screen.findByRole('link', { name: 'Back to notices' })).toHaveAttribute(
      'href',
      '/resident/notices',
    );
  });
  it('words an acknowledge failure', async () => {
    show(
      <NoticeDetailScreen id={412} />,
      routes({ 'POST /me/notices/412/acknowledge': err(409, 'INVALID_STATE') }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'I have read and understood' }));
    expect(await screen.findByText(/cannot be done in its current state/)).toBeInTheDocument();
  });
});

describe('Survey answering', () => {
  it('validates answers per type', () => {
    const rating: SurveyQuestion = {
      id: 1,
      type: 'RATING',
      prompt: 'r',
      helpText: null,
      isRequired: true,
      options: [],
      maxSelections: null,
      minValue: null,
      maxValue: null,
      maxLength: null,
    };
    expect(problemFor(rating, undefined)).toMatch(/needs an answer/);
    expect(problemFor(rating, { text: '6' })).toMatch(/5 or less/);
    expect(problemFor(rating, { text: '4' })).toBeNull();
    expect(answerFor(rating, { text: '4' })).toEqual({ questionId: 1, number: 4 });
    const multi: SurveyQuestion = { ...rating, type: 'MULTI_CHOICE', maxSelections: 1 };
    expect(problemFor(multi, { keys: ['o1', 'o2'] })).toMatch(/at most 1/);
    expect(answerFor({ ...rating, type: 'YES_NO' }, { key: 'yes' })).toEqual({
      questionId: 1,
      optionKey: 'yes',
    });
  });

  it('goes one question at a time, reviews, and submits', async () => {
    const api = show(<SurveyScreen id={9} />, {
      'GET /me/surveys/9': ok(surveyRaw()),
      'POST /me/surveys/9/responses': ok({ submissionId: 'u-1', submittedAt: 'x' }),
    });
    expect(await screen.findByText('Question 1 of 3')).toBeInTheDocument();
    expect(screen.getByText(/This survey is anonymous/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('needs an answer');
    await userEvent.click(screen.getByRole('radio', { name: '6-9 pm' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('radio', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByText('Review your answers')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/surveys/9/responses')?.body).toEqual({
        answers: [
          { questionId: 51, optionKey: 'o2' },
          { questionId: 52, number: 4 },
        ],
      }),
    );
    expect(await screen.findByText(/Your answers are recorded/)).toBeInTheDocument();
  });

  it('offers the other flats after one flat is answered', async () => {
    const api = show(<SurveyScreen id={9} />, {
      'GET /me/surveys/9': ok(
        surveyRaw({
          responseScope: 'FLAT',
          questions: [{ id: 52, type: 'RATING', prompt: 'Rate the gym', isRequired: true }],
          units: [
            { unitId: 1, label: 'A-104' },
            { unitId: 2, label: 'B-201' },
          ],
        }),
      ),
      'POST /me/surveys/9/responses': ok({ submissionId: 'u-1', submittedAt: 'x' }),
    });
    await userEvent.click(await screen.findByRole('radio', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.selectOptions(screen.getByLabelText('Answer for flat'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    expect(await screen.findByText('A-104: Answered')).toBeInTheDocument();
    expect(screen.getByText('B-201: Not answered')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Answer for another flat' }));
    await userEvent.click(await screen.findByRole('radio', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.queryByRole('option', { name: 'A-104' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Answer for flat'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    await waitFor(() => expect(api.last('POST', '/me/surveys/9/responses')?.body).toMatchObject({ unitId: 2 }));
    expect(await screen.findByText(/Your answers are recorded/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Answer for another flat' })).toBeNull();
  });
  it('says so for a cancelled survey', async () => {
    show(<SurveyScreen id={9} />, { 'GET /me/surveys/9': ok(surveyRaw({ status: 'CANCELLED' })) });
    expect(await screen.findByText('This survey was cancelled.')).toBeInTheDocument();
  });

  it('shows results for a closed survey and a closed notice for others', async () => {
    show(<SurveyScreen id={9} />, {
      'GET /me/surveys/9': ok(
        surveyRaw({
          status: 'CLOSED',
          results: {
            responses: 100,
            recipients: 141,
            questions: [
              {
                questionId: 51,
                type: 'SINGLE_CHOICE',
                prompt: 'Preferred gym hours?',
                answered: 98,
                options: [{ key: 'o1', label: '6-9 am', count: 61, pct: '62.2' }],
              },
            ],
          },
        }),
      ),
    });
    expect(await screen.findByText('6-9 am: 61 (62.2%)')).toBeInTheDocument();
  });

  it('treats a duplicate submission as done', async () => {
    show(<SurveyScreen id={9} />, {
      'GET /me/surveys/9': ok(
        surveyRaw({
          questions: [{ id: 53, type: 'TEXT', prompt: 'Anything else?', isRequired: false, maxLength: 100 }],
        }),
      ),
      'POST /me/surveys/9/responses': err(409, 'SURVEY_ALREADY_RESPONDED'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    expect(await screen.findByText(/Your answers are recorded/)).toBeInTheDocument();
  });
});
