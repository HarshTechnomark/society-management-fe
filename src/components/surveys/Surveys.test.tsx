import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMM_FEATURES,
  COMM_PERMS,
  pagination,
  resultsRaw,
  surveyItemRaw,
  surveyRaw,
} from '@/test/communicationFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { ToastProvider } from '@/components/ui/Toast';
import { SurveysScreen } from './admin/SurveysScreen';
import { blankQuestion, questionInput, surveyProblems } from './admin/format';

vi.mock('next/navigation', () => navigationMock());
beforeEach(() => {
  resetAll();
  signInAs(COMM_PERMS, COMM_FEATURES);
});

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const list = (items: unknown[]) => ({ data: items, extra: { pagination: pagination(items.length) } });
const routes = (items: unknown[] = [surveyItemRaw()]) => ({
  'GET /surveys': list(items),
  'GET /locations': ok([]),
});

describe('Surveys list', () => {
  it('shows status, anonymous chip, closing time and the responses meter', async () => {
    mockApi(routes());
    wrap(<SurveysScreen />);
    const li = (await screen.findAllByRole('listitem')).find(l => l.textContent?.includes('Gym timings'))!;
    expect(within(li).getByText('Open')).toBeInTheDocument();
    expect(within(li).getByText('Anonymous')).toBeInTheDocument();
    expect(within(li).getByText('100 of 141 responded')).toBeInTheDocument();
    expect(within(li).getByRole('progressbar', { name: 'Responses to Gym timings' })).toHaveAttribute(
      'aria-valuenow',
      '71',
    );
  });

  it('filters by status with strict query names', async () => {
    const api = mockApi(routes());
    wrap(<SurveysScreen />);
    await screen.findByText('Gym timings');
    await userEvent.click(screen.getByRole('button', { name: 'Closed' }));
    await waitFor(() => {
      const u = new URL(String(api.fn.mock.calls.at(-1)![0]));
      expect(u.searchParams.get('status')).toBe('CLOSED');
      expect([...u.searchParams.keys()].sort()).toEqual(['limit', 'page', 'status']);
    });
  });

  it('shows the empty state and the error state', async () => {
    mockApi(routes([]));
    wrap(<SurveysScreen />);
    expect(await screen.findByText('No surveys')).toBeInTheDocument();
  });
  it('retries after an error', async () => {
    mockApi({ ...routes(), 'GET /surveys': [err(500, 'INTERNAL_ERROR'), list([surveyItemRaw()])] });
    wrap(<SurveysScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Gym timings')).toBeInTheDocument();
  });

  it('offers close, cancel on open surveys and edit, delete on drafts, by permission', async () => {
    mockApi(
      routes([
        surveyItemRaw(),
        surveyItemRaw({ id: 10, title: 'Parking review', status: 'DRAFT', responseCount: 0 }),
      ]),
    );
    wrap(<SurveysScreen />);
    await screen.findByText('Parking review');
    expect(screen.getByRole('button', { name: 'Close now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Results' })).toHaveLength(1);
  });

  it('hides write buttons for a viewer', async () => {
    signInAs(['communication.surveys.view'], COMM_FEATURES);
    mockApi(routes());
    wrap(<SurveysScreen />);
    await screen.findByText('Gym timings');
    expect(screen.queryByRole('button', { name: 'New survey' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close now' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Results' })).toBeInTheDocument();
  });

  it('closes now with the version, and cancels only with a reason of 10 characters', async () => {
    const api = mockApi({
      ...routes(),
      'POST /surveys/9/close': ok(surveyRaw({ status: 'CLOSED' })),
      'POST /surveys/9/cancel': ok(surveyRaw({ status: 'CANCELLED' })),
    });
    wrap(<SurveysScreen />);
    await screen.findByText('Gym timings');
    await userEvent.click(screen.getByRole('button', { name: 'Close now' }));
    await waitFor(() => expect(api.last('POST', '/surveys/9/close')?.body).toEqual({ version: 2 }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const modal = await screen.findByRole('dialog');
    const go = within(modal).getByRole('button', { name: 'Cancel survey' });
    expect(go).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText(/Reason/), 'Not needed any more');
    await userEvent.click(go);
    await waitFor(() =>
      expect(api.last('POST', '/surveys/9/cancel')?.body).toEqual({
        version: 2,
        reason: 'Not needed any more',
      }),
    );
  });
});

describe('Survey results', () => {
  it('shows a bar per option, the rating, NPS, hidden text and the response count', async () => {
    mockApi({ ...routes(), 'GET /surveys/9/results': ok(resultsRaw()) });
    wrap(<SurveysScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Results' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByTestId('response-count')).toHaveTextContent(
      '100 of 141 responded · anonymous',
    );
    expect(within(dlg).getByRole('progressbar', { name: '6–9 am' })).toHaveAttribute('aria-valuenow', '62.2');
    expect(within(dlg).getByText('61 · 62.2%')).toBeInTheDocument();
    expect(within(dlg).getByTestId('rating-average')).toHaveTextContent('3.90');
    expect(within(dlg).getByRole('progressbar', { name: '4 stars' })).toHaveAttribute('aria-valuenow', '40');
    expect(within(dlg).getByTestId('nps-score')).toHaveTextContent('22');
    expect(within(dlg).getByText('40 promoters')).toBeInTheDocument();
    expect(within(dlg).getByText(/hidden until at least 5 people/)).toBeInTheDocument();
  });

  it('exports the CSV only with the export permission', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const api = mockApi({
      ...routes(),
      'GET /surveys/9/results': ok(resultsRaw()),
      'GET /surveys/9/results/export': ok('csv'),
    });
    wrap(<SurveysScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Results' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/surveys/9/results/export')).toBe(true));
  });
  it('has no export button without the permission', async () => {
    signInAs(['communication.surveys.view'], COMM_FEATURES);
    mockApi({ ...routes(), 'GET /surveys/9/results': ok(resultsRaw()) });
    wrap(<SurveysScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Results' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByTestId('response-count');
    expect(within(dlg).queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
  });
});

describe('Survey editor', () => {
  const openNew = async (extra: Record<string, never> = {}) => {
    const api = mockApi({ ...routes(), ...extra });
    wrap(<SurveysScreen />);
    await screen.findByText('Gym timings');
    await userEvent.click(screen.getByRole('button', { name: 'New survey' }));
    return { api, dlg: await screen.findByRole('dialog') };
  };

  it('needs a title and, to open, a question', async () => {
    const { dlg } = await openNew();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Open survey' }));
    expect(await within(dlg).findByText('Add a title (5+ characters).')).toBeInTheDocument();
    expect(within(dlg).getByText('Add at least one question.')).toBeInTheDocument();
  });

  it('builds questions, reorders them and saves a draft with keyed options', async () => {
    const { api, dlg } = await openNew({ 'POST /surveys': ok(surveyRaw()) as never });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Gym timings');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add question' }));
    const q1 = within(dlg).getByRole('listitem', { name: 'Question 1' });
    await userEvent.type(within(q1).getByLabelText('Question'), 'Preferred hours?');
    await userEvent.type(within(q1).getByLabelText('Option 1'), '6 to 9 am');
    await userEvent.type(within(q1).getByLabelText('Option 2'), '6 to 9 pm');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add question' }));
    const q2 = within(dlg).getByRole('listitem', { name: 'Question 2' });
    await userEvent.selectOptions(within(q2).getByLabelText('Type'), 'RATING');
    await userEvent.type(within(q2).getByLabelText('Question'), 'Rate the gym');
    await userEvent.click(within(q2).getByRole('button', { name: 'Move question 2 up' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.last('POST', '/surveys')).toBeTruthy());
    expect(api.last('POST', '/surveys')?.body).toEqual({
      title: 'Gym timings',
      description: '',
      isAnonymous: false,
      responseScope: 'PERSON',
      resultsVisibility: 'ADMINS',
      audience: { type: 'ALL', relation: 'ANY' },
      questions: [
        { type: 'RATING', prompt: 'Rate the gym', isRequired: true },
        {
          type: 'SINGLE_CHOICE',
          prompt: 'Preferred hours?',
          isRequired: true,
          options: [
            { key: 'o1', label: '6 to 9 am' },
            { key: 'o2', label: '6 to 9 pm' },
          ],
        },
      ],
    });
    const call = api.fn.mock.calls.find(
      c => (c[1] as RequestInit)?.method === 'POST' && String(c[0]).endsWith('/surveys'),
    )!;
    expect(new Headers((call[1] as RequestInit).headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('opens: saves, then publishes with closesAt', async () => {
    const { api, dlg } = await openNew({
      'POST /surveys': ok(surveyRaw({ id: 20, version: 1 })) as never,
      'POST /surveys/20/publish': ok(surveyRaw({ id: 20, status: 'OPEN', version: 2 })) as never,
    });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Gym timings');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add question' }));
    const q1 = within(dlg).getByRole('listitem', { name: 'Question 1' });
    await userEvent.selectOptions(within(q1).getByLabelText('Type'), 'YES_NO');
    await userEvent.type(within(q1).getByLabelText('Question'), 'Open on Sundays?');
    await userEvent.type(within(dlg).getByLabelText('Closes on'), '2099-01-01T10:00');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Open survey' }));
    await waitFor(() => expect(api.last('POST', '/surveys/20/publish')).toBeTruthy());
    const body = api.last('POST', '/surveys/20/publish')!.body as { version: number; closesAt: string };
    expect(body.version).toBe(1);
    expect(new Date(body.closesAt).getFullYear()).toBe(2099);
  });

  it('edits an existing draft with its version and shows its questions', async () => {
    const api = mockApi({
      ...routes([surveyItemRaw({ status: 'DRAFT', responseCount: 0 })]),
      'GET /surveys/9': ok(surveyRaw()),
      'PATCH /surveys/9': ok(surveyRaw()),
    });
    wrap(<SurveysScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dlg = await screen.findByRole('dialog', { name: 'Edit survey' });
    expect(await within(dlg).findByDisplayValue('Preferred gym hours?')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.last('PATCH', '/surveys/9')).toBeTruthy());
    expect((api.last('PATCH', '/surveys/9')!.body as { version: number }).version).toBe(2);
  });

  it('shows the API wording for a refused publish', async () => {
    const { dlg } = await openNew({
      'POST /surveys': ok(surveyRaw({ id: 20 })) as never,
      'POST /surveys/20/publish': err(422, 'SURVEY_CLOSE_INVALID') as never,
    });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Gym timings');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add question' }));
    await userEvent.selectOptions(within(dlg).getByLabelText('Type'), 'YES_NO');
    await userEvent.type(within(dlg).getByLabelText('Question'), 'Open on Sundays?');
    await userEvent.type(within(dlg).getByLabelText('Closes on'), '2099-01-01T10:00');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Open survey' }));
    expect(
      await within(dlg).findByText(/closing time must be between 1 hour and 90 days/),
    ).toBeInTheDocument();
  });
});

describe('Survey form helpers', () => {
  it('writes only the fields a type allows', () => {
    const q = { ...blankQuestion('NUMBER'), prompt: 'How many?', minValue: '1', maxValue: '9' };
    expect(questionInput(q)).toEqual({
      type: 'NUMBER',
      prompt: 'How many?',
      isRequired: true,
      minValue: 1,
      maxValue: 9,
    });
    const t = {
      ...blankQuestion('TEXT'),
      prompt: 'Ideas?',
      maxLength: '200',
      isRequired: false,
      helpText: 'Short',
    };
    expect(questionInput(t)).toEqual({
      type: 'TEXT',
      prompt: 'Ideas?',
      isRequired: false,
      helpText: 'Short',
      maxLength: 200,
    });
    const m = {
      ...blankQuestion('MULTI_CHOICE'),
      prompt: 'Pick',
      options: ['a', '', 'b'],
      maxSelections: '2',
    };
    expect(questionInput(m)).toMatchObject({
      options: [
        { key: 'o1', label: 'a' },
        { key: 'o2', label: 'b' },
      ],
      maxSelections: 2,
    });
  });
  it('reports problems in the API wording', () => {
    const bad = { ...blankQuestion('SINGLE_CHOICE'), prompt: 'Which?', options: ['only one', ''] };
    expect(surveyProblems('abc', [bad], true)).toMatchObject({
      title: 'Add a title (5+ characters).',
      [`q${bad.uid}`]: 'A choice question needs 2 or more options.',
    });
    expect(surveyProblems('Good title', [], true).questions).toBe('Add at least one question.');
    expect(surveyProblems('Good title', [], false)).toEqual({});
    const num = { ...blankQuestion('NUMBER'), prompt: 'Qty?', minValue: '5', maxValue: '5' };
    expect(surveyProblems('Good title', [num], false)[`q${num.uid}`]).toMatch(/largest value/);
  });
});
