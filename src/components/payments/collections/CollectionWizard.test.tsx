import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COL_FEATURES, COL_PERMS, colRaw } from '@/test/collectionsFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { normaliseDetail } from '@/services/collectionsMappers';
import { CollectionWizard } from './CollectionWizard';

vi.mock('next/navigation', () => navigationMock());

const FUNDS = ok([{ id: 4, name: 'Festival fund', status: 'ACTIVE' }]);
const BUILDINGS = ok([
  { id: 1, name: 'Tower A', unitCounts: { active: 40 } },
  { id: 2, name: 'Tower B', unitCounts: { active: 33 } },
]);
const base = (extra: Parameters<typeof mockApi>[0] = {}) => ({
  'GET /accounts/funds': FUNDS,
  'GET /buildings': BUILDINGS,
  ...extra,
});

function setup(routes: Parameters<typeof mockApi>[0] = {}, editing?: ReturnType<typeof normaliseDetail>) {
  signInAs(COL_PERMS, COL_FEATURES);
  const api = mockApi(base(routes));
  const onDone = vi.fn();
  const onClose = vi.fn();
  render(<CollectionWizard editing={editing} onClose={onClose} onDone={onDone} />);
  return { api, onDone, onClose };
}
const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }));
const type = async (label: string | RegExp, text: string) => {
  const el = screen.getByLabelText(label);
  await userEvent.clear(el);
  if (text) await userEvent.type(el, text);
};

/** Fills what is needed and moves to the visible step 3 (Who pays) or 4 (Fund). */
async function gotoStep(n: 3 | 4) {
  await type(/Title/, 'Ganesh Utsav 2026');
  await type(/Purpose/, 'Decoration and prasad for ten days.');
  await next();
  await type(/Amount per flat/, '1000');
  await next();
  if (n === 4) await next();
}
beforeEach(resetAll);

describe('New collection wizard', () => {
  it('shows the four steps and the validation messages of 8.21 step by step', async () => {
    setup();
    expect(screen.getByRole('list', { name: 'Steps' })).toHaveTextContent('1 What');
    expect(screen.getByRole('list', { name: 'Steps' })).toHaveTextContent('4 Fund');
    await next();
    expect(screen.getByText('Enter a title of 4 to 80 characters.')).toBeInTheDocument();
    expect(screen.getByText('Describe the purpose in 10 to 1000 characters.')).toBeInTheDocument();
    await type(/Title/, 'Ganesh Utsav');
    await type(/Purpose/, 'Decoration and prasad.');
    await next();
    // step 2
    expect(screen.getByLabelText(/Amount per flat/)).toBeInTheDocument();
    expect(screen.getByText('Nobody becomes a defaulter. No late interest.')).toBeInTheDocument();
    expect(screen.getByText("Adds an invoice to every flat's dues.")).toBeInTheDocument();
    await next();
    expect(screen.getByText('Enter an amount of ₹1 to ₹1,00,000 per flat.')).toBeInTheDocument();
  });

  it('a suggested amount needs a minimum that is not above it; voluntary needs no amount; mandatory needs fixed', async () => {
    setup();
    await type(/Title/, 'Ganesh Utsav');
    await type(/Purpose/, 'Decoration and prasad.');
    await next();
    await userEvent.selectOptions(screen.getByLabelText(/How much does each flat pay/), 'MIN_PER_UNIT');
    expect(screen.getByRole('radio', { name: /Mandatory/ })).toBeDisabled();
    expect(screen.getByText('A mandatory collection must be a fixed amount per flat.')).toBeInTheDocument();
    await type(/Suggested amount/, '500');
    await type(/Minimum/, '800');
    await next();
    expect(screen.getByText('The minimum cannot be more than the suggested amount.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/How much does each flat pay/), 'VOLUNTARY');
    await type(/Suggested amount/, '');
    await next();
    expect(screen.getByLabelText(/Due date/)).toBeInTheDocument();
  });

  it('who pays: all flats, a tower, chosen flats, with the flat count and the due date rule', async () => {
    setup({ 'GET /units': ok([{ id: 51, label: 'A-1203' }]) });
    await gotoStep(3);
    expect(
      await screen.findByText(
        'Up to 73 flats will see this in their Pay list. Flats with no resident are left out when you publish.',
      ),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Who pays'), 'BUILDINGS');
    await next();
    expect(screen.getByText('Choose at least one tower.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Tower B'));
    expect(
      screen.getByText(
        'Up to 33 flats will see this in their Pay list. Flats with no resident are left out when you publish.',
      ),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Who pays'), 'UNITS');
    await next();
    expect(screen.getByText('Choose at least one flat.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Find flats'), 'A-12');
    await userEvent.click(await screen.findByRole('button', { name: 'Add A-1203' }));
    expect(screen.getByRole('list', { name: 'Chosen flats' })).toHaveTextContent('A-1203');
    expect(
      screen.getByText(
        'Up to 1 flat will see this in their Pay list. Flats with no resident are left out when you publish.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Also ask flats with no resident'));
    expect(screen.getByText('1 flat will see this in their Pay list')).toBeInTheDocument();
    fireDue('2000-01-01');
    await next();
    expect(screen.getByText('The due date must be from today to one year ahead.')).toBeInTheDocument();
  });

  it('fund step: hint with flats times amount, notice, privacy and the approval note', async () => {
    setup();
    await gotoStep(4);
    expect(await screen.findByText(/Up to 73 flats × ₹1,000 = ₹73,000/)).toBeInTheDocument();
    expect(screen.getByLabelText('Also send a notice with a Pay button')).toBeChecked();
    expect(screen.getByLabelText('Who paid list')).toHaveValue('COUNT_ONLY');
    expect(
      screen.getByText('A different committee member must approve before you can publish.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(screen.getByText('Choose the fund this money goes to.')).toBeInTheDocument();
  });

  it('fund step: when the list of funds is not available the fund number is typed', async () => {
    setup({ 'GET /accounts/funds': err(404, 'NOT_FOUND') });
    await gotoStep(4);
    const input = await screen.findByLabelText(/^Fund number/);
    await userEvent.type(input, '4x');
    expect(input).toHaveValue('4');
  });

  it('submits for approval: creates the draft, then submits it, and reports it', async () => {
    const { api, onDone } = setup({
      'POST /collections': ok(colRaw({ status: 'DRAFT', version: 1 })),
      'POST /collections/12/submit': ok(colRaw({ status: 'PENDING_APPROVAL', version: 2 })),
    });
    await gotoStep(4);
    await userEvent.selectOptions(await screen.findByLabelText(/^Fund/), '4');
    await userEvent.click(screen.getByLabelText('Also send a notice with a Pay button'));
    await userEvent.selectOptions(screen.getByLabelText('Who paid list'), 'FLATS_ONLY');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.last('POST', '/collections')?.body).toMatchObject({
      title: 'Ganesh Utsav 2026',
      kind: 'FESTIVAL',
      amountMode: 'FIXED_PER_UNIT',
      amountPerUnitPaise: 100000,
      isMandatory: false,
      audienceType: 'ALL',
      includeVacant: false,
      fundId: 4,
      payListVisibility: 'FLATS_ONLY',
      sendNotice: false,
    });
    expect(api.last('POST', '/collections/12/submit')?.body).toEqual({ version: 1 });
    expect(onDone.mock.calls[0][1]).toBe(true);
  });

  it('saves as a draft without submitting', async () => {
    const { api, onDone } = setup({ 'POST /collections': ok(colRaw({ status: 'DRAFT', version: 1 })) });
    await gotoStep(4);
    await userEvent.selectOptions(await screen.findByLabelText(/^Fund/), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.calls.some(c => c.path.endsWith('/submit'))).toBe(false);
    expect(onDone.mock.calls[0][1]).toBe(false);
  });

  it('a retry after a failed submit patches the saved draft and does not create another', async () => {
    const { api, onDone } = setup({
      'POST /collections': ok(colRaw({ status: 'DRAFT', version: 1 })),
      'PATCH /collections/12': ok(colRaw({ status: 'DRAFT', version: 2 })),
      'POST /collections/12/submit': [
        err(422, 'COLLECTION_DUE_DATE_PAST'),
        ok(colRaw({ status: 'PENDING_APPROVAL', version: 3 })),
      ],
    });
    await gotoStep(4);
    await userEvent.selectOptions(await screen.findByLabelText(/^Fund/), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    // the due date error goes back to the step with that field
    expect(
      await screen.findByText('The due date is in the past. Choose a date from today.'),
    ).toBeInTheDocument();
    await next();
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.calls.filter(c => c.method === 'POST' && c.path === '/collections')).toHaveLength(1);
    expect(api.last('PATCH', '/collections/12')?.body).toMatchObject({ version: 1 });
  });

  it('shows a duplicate title on the title step', async () => {
    setup({ 'POST /collections': err(409, 'COLLECTION_TITLE_EXISTS') });
    await gotoStep(4);
    await userEvent.selectOptions(await screen.findByLabelText(/^Fund/), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(
      await screen.findByText('A collection with this title already exists. Choose another title.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toHaveValue('Ganesh Utsav 2026');
  });

  it('edits a draft: starts filled and patches with the version', async () => {
    const draft = normaliseDetail(colRaw({ status: 'DRAFT', version: 4 }));
    const { api, onDone } = setup(
      {
        'PATCH /collections/12': ok(colRaw({ status: 'DRAFT', version: 5 })),
      },
      draft,
    );
    expect(screen.getByText('Edit collection')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toHaveValue('Ganesh Utsav 2026');
    await next();
    expect(screen.getByLabelText(/Amount per flat/)).toHaveValue('1000');
    await next();
    await next();
    await userEvent.click(await screen.findByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.last('PATCH', '/collections/12')?.body).toMatchObject({ version: 4, fundId: 4 });
  });

  it('Back and Cancel', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

function fireDue(value: string) {
  const el = screen.getByLabelText(/Due date/) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
