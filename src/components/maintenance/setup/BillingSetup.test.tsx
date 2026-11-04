import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import {
  BILLING_FEATURES,
  BILLING_PERMS,
  HEADS_RAW,
  headRaw,
  policyRaw,
  ruleRaw,
  splitRaw,
  versionRaw,
} from '@/test/billingSetupFixtures';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { page } from '@/test/societyFixtures';
import { BillingSetupScreen } from './BillingSetupScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const list = (rows: unknown[]) => ok(rows, 'OK', page(rows.length, 1, 100));

function renderIt(routes: Routes = {}, perms = BILLING_PERMS, features = BILLING_FEATURES) {
  setMe(sampleMe({ permissions: perms, features }));
  const api = mockApi({
    'GET /billing/rules': list([ruleRaw()]),
    'GET /billing/charge-heads': list(HEADS_RAW),
    'GET /billing/split-rules': list([splitRaw()]),
    'GET /billing/late-fee-policies': list([policyRaw()]),
    ...routes,
  });
  render(
    <ToastProvider>
      <BillingSetupScreen />
    </ToastProvider>,
  );
  return api;
}
const tab = (name: string) => userEvent.click(screen.getByRole('tab', { name }));
const date = (label: string, v: string) =>
  fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value: v } });

beforeEach(resetAll);

describe('gates', () => {
  it('shows no access without the view permission', async () => {
    renderIt({}, []);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
  it('shows the plan prompt when a tab is not in the plan', async () => {
    renderIt(
      {},
      BILLING_PERMS,
      BILLING_FEATURES.filter(f => f !== 'billing.charge_head_master'),
    );
    await screen.findByText('Maintenance (service charges)');
    await tab('Charge heads');
    expect(
      await screen.findByText(/not part of your current plan|not available in your plan/),
    ).toBeInTheDocument();
  });
  it('hides the edit buttons for a viewer', async () => {
    renderIt({}, ['settings.billing_rules.view']);
    await screen.findByText('Maintenance (service charges)');
    expect(screen.queryByRole('button', { name: 'Add rate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Change rate of/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /History of/ })).toBeInTheDocument();
  });
});

describe('charge heads', () => {
  it('shows a skeleton while loading', async () => {
    renderIt();
    fireEvent.click(screen.getByRole('tab', { name: 'Charge heads' }));
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });
  it('lists the heads with payer, GST, ledger and a System marker', async () => {
    renderIt();
    await tab('Charge heads');
    const row = (await screen.findByRole('button', { name: 'Edit Sinking fund' })).closest('tr')!;
    expect(within(row).getByText('SINKING_FUND')).toBeInTheDocument();
    expect(within(row).getByText('Owner')).toBeInTheDocument();
    expect(within(row).getByText('Threshold')).toBeInTheDocument();
    expect(within(row).getByText('2410')).toBeInTheDocument();
    const sys = screen.getByText('Interest on arrears').closest('tr')!;
    expect(within(sys).getByText('System')).toBeInTheDocument();
    expect(within(sys).queryByRole('button', { name: /Archive/ })).not.toBeInTheDocument();
  });
  it('shows an empty state', async () => {
    renderIt({ 'GET /billing/charge-heads': list([]) });
    await tab('Charge heads');
    expect(await screen.findByText('No charge heads')).toBeInTheDocument();
  });
  it('shows the error state with the support reference', async () => {
    renderIt({ 'GET /billing/charge-heads': err(500, 'INTERNAL_ERROR') });
    await tab('Charge heads');
    expect(await screen.findByText('req_test')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });
  it('adds a head and sends paise-free, trimmed fields', async () => {
    const api = renderIt({ 'POST /billing/charge-heads': ok(headRaw({ id: 20, key: 'LIFT_FUND' })) });
    await tab('Charge heads');
    await userEvent.click(await screen.findByRole('button', { name: 'Add charge head' }));
    await userEvent.type(screen.getByLabelText(/^Key/), 'lift_fund');
    await userEvent.type(screen.getByLabelText(/^Name/), ' Lift fund ');
    await userEvent.type(screen.getByLabelText(/^Ledger account code/), '2430');
    await userEvent.click(document.querySelector('button[form=charge-head-form]')!);
    await waitFor(() => expect(api.last('POST', '/billing/charge-heads')).toBeTruthy());
    expect(api.last('POST', '/billing/charge-heads')!.body).toMatchObject({
      key: 'LIFT_FUND',
      name: 'Lift fund',
      headType: 'OTHER',
      payerRouting: 'BILL_TO',
      gstTreatment: 'NONE',
      ledgerAccountCode: '2430',
      sortOrder: 100,
    });
  });
  it('asks for a SAC code when GST applies and forces owner routing for a fund', async () => {
    renderIt();
    await tab('Charge heads');
    await userEvent.click(await screen.findByRole('button', { name: 'Add charge head' }));
    await userEvent.selectOptions(screen.getByLabelText('GST'), 'THRESHOLD');
    expect(screen.getByLabelText(/^SAC code/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'SINKING_FUND');
    expect(screen.getByLabelText('Billed to')).toHaveValue('OWNER');
  });
  it('shows the message of CHARGE_HEAD_KEY_TAKEN in the drawer', async () => {
    renderIt({ 'POST /billing/charge-heads': err(409, 'CHARGE_HEAD_KEY_TAKEN') });
    await tab('Charge heads');
    await userEvent.click(await screen.findByRole('button', { name: 'Add charge head' }));
    await userEvent.type(screen.getByLabelText(/^Key/), 'LIFT_FUND');
    await userEvent.type(screen.getByLabelText(/^Name/), 'Lift fund');
    await userEvent.type(screen.getByLabelText(/^Ledger account code/), '2430');
    await userEvent.click(document.querySelector('button[form=charge-head-form]')!);
    expect(
      await screen.findByText('A charge head with this key already exists. Pick another key.'),
    ).toBeInTheDocument();
  });
  it('limits a system head to name, description, order and SAC', async () => {
    renderIt();
    await tab('Charge heads');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Interest on arrears' }));
    expect(screen.getByText(/This is a system head/)).toBeInTheDocument();
    expect(screen.getByLabelText('Billed to')).toBeDisabled();
    expect(screen.getByLabelText(/^Ledger account code/)).toBeDisabled();
    expect(screen.getByLabelText(/^Name/)).toBeEnabled();
  });
  it('archives with a reason and shows CHARGE_HEAD_IN_USE', async () => {
    const api = renderIt({ 'DELETE /billing/charge-heads/2': err(409, 'CHARGE_HEAD_IN_USE') });
    await tab('Charge heads');
    await userEvent.click(await screen.findByRole('button', { name: 'Archive Sinking fund' }));
    await userEvent.type(screen.getByLabelText(/Reason/), 'No longer collected');
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText(/live billing rate still uses this charge head/)).toBeInTheDocument();
    expect(api.last('DELETE', '/billing/charge-heads/2')!.body).toEqual({
      reason: 'No longer collected',
      version: 1,
    });
  });
});

describe('rates', () => {
  it('shows a skeleton, then the current rate, the next rate with its date and a pending chip', async () => {
    renderIt({
      'GET /billing/rules': list([
        ruleRaw({
          nextVersion: versionRaw({
            id: 40,
            versionNo: 4,
            ratePerSqftPaise: 350,
            effectiveFrom: '2027-04-01',
          }),
          pendingVersion: versionRaw({
            id: 41,
            versionNo: 5,
            ratePerSqftPaise: 380,
            effectiveFrom: '2027-10-01',
            status: 'PENDING_APPROVAL',
          }),
        }),
      ]),
    });
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    const card = (await screen.findByText('Maintenance (service charges)')).closest('li')!;
    expect(within(card).getByText('₹3.20 per sq ft per month')).toBeInTheDocument();
    expect(within(card).getByText('₹3.50 per sq ft per month')).toBeInTheDocument();
    expect(within(card).getByText(/from 1 Apr 2027/)).toBeInTheDocument();
    expect(within(card).getAllByText('Waiting for approval').length).toBeGreaterThan(0);
    expect(within(card).getByRole('link', { name: 'Open in approvals' })).toHaveAttribute(
      'href',
      '/admin/dev-approvals',
    );
  });
  it('shows an empty state and an error state', async () => {
    renderIt({ 'GET /billing/rules': list([]) });
    expect(await screen.findByText('No rates yet')).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    renderIt({ 'GET /billing/rules': err(403, 'PERMISSION_DENIED') });
    expect(
      await screen.findByText('You do not have permission to change billing rules.'),
    ).toBeInTheDocument();
  });
  it('changes a rate: posts the new version in paise and says it was sent for approval', async () => {
    const api = renderIt({
      'POST /billing/rules/7/versions': ok(
        versionRaw({ id: 50, versionNo: 4, status: 'PENDING_APPROVAL', ratePerSqftPaise: 350 }),
      ),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Change rate of Maintenance/ }));
    const sqft = screen.getByLabelText(/^Rate per sq ft/);
    await userEvent.clear(sqft);
    await userEvent.type(sqft, '3.5');
    date('Effective from', '2027-04-01');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'AGM resolution 4 of 2026');
    expect(screen.getByText(/New rate:/)).toHaveTextContent('₹3.50 per sq ft per month');
    await userEvent.click(document.querySelector('button[form=rate-form]')!);
    await waitFor(() => expect(api.last('POST', '/billing/rules/7/versions')).toBeTruthy());
    expect(api.last('POST', '/billing/rules/7/versions')!.body).toEqual({
      rateType: 'PER_SQFT',
      ratePerSqftPaise: 350,
      effectiveFrom: '2027-04-01',
      reason: 'AGM resolution 4 of 2026',
    });
    expect(await screen.findByText('Rate change sent for approval.')).toBeInTheDocument();
  });
  it('shows quarterly amounts when a cycle is chosen', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: /Change rate of Maintenance/ }));
    await userEvent.selectOptions(screen.getByLabelText('Show amounts for'), 'QUARTERLY');
    date('Effective from', '2027-04-01');
    expect(screen.getByText(/New rate:/)).toHaveTextContent('for 3 months');
  });
  it('refuses a date that is not the first of a month before sending', async () => {
    const api = renderIt();
    await userEvent.click(await screen.findByRole('button', { name: /Change rate of Maintenance/ }));
    date('Effective from', '2027-04-15');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'AGM resolution');
    await userEvent.click(document.querySelector('button[form=rate-form]')!);
    expect(await screen.findByText('Pick the first day of a billing period.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });
  it('shows RULE_EFFECTIVE_IN_BILLED_PERIOD from the server', async () => {
    renderIt({ 'POST /billing/rules/7/versions': err(422, 'RULE_EFFECTIVE_IN_BILLED_PERIOD') });
    await userEvent.click(await screen.findByRole('button', { name: /Change rate of Maintenance/ }));
    date('Effective from', '2027-04-01');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'AGM resolution');
    await userEvent.click(document.querySelector('button[form=rate-form]')!);
    expect(
      await screen.findByText('Bills were already issued for that period. Pick a later date.'),
    ).toBeInTheDocument();
  });
  it('blocks a second change while one is pending', async () => {
    renderIt({
      'GET /billing/rules': list([
        ruleRaw({ pendingVersion: versionRaw({ id: 41, versionNo: 4, status: 'PENDING_APPROVAL' }) }),
      ]),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Change rate of Maintenance/ }));
    expect(screen.getByText(/is waiting for approval/)).toBeInTheDocument();
    expect(document.querySelector('button[form=rate-form]')).toBeDisabled();
  });
  it('offers only a percent or no charge for a non-occupancy head and caps it at 10', async () => {
    renderIt({ 'GET /billing/rules': list([]) });
    await screen.findByText('No rates yet');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add rate' })[0]);
    await userEvent.selectOptions(screen.getByLabelText(/^Charge head/), '3');
    const types = within(screen.getByLabelText('Rate type'))
      .getAllByRole('option')
      .map(o => o.textContent);
    expect(types).toEqual(['Percent of other heads', 'No charge (stops the head)']);
    await userEvent.type(screen.getByLabelText(/^Percent/), '12');
    await userEvent.click(screen.getByLabelText('Maintenance (service charges)'));
    date('Effective from', '2027-04-01');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Directive');
    await userEvent.click(document.querySelector('button[form=rate-form]')!);
    expect(await screen.findByText(/capped at 10 percent/)).toBeInTheDocument();
  });
  it('creates a rule in setup mode and says the rate was saved', async () => {
    const api = renderIt({
      'GET /billing/rules': list([]),
      'POST /billing/rules': ok(ruleRaw()),
    });
    await screen.findByText('No rates yet');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add rate' })[0]);
    await userEvent.selectOptions(screen.getByLabelText(/^Charge head/), '2');
    expect(screen.getByLabelText(/^Rule name/)).toHaveValue('Sinking fund - all flats');
    await userEvent.selectOptions(screen.getByLabelText('Rate type'), 'FLAT_PER_UNIT');
    await userEvent.type(screen.getByLabelText(/^Amount per flat/), '600');
    date('Effective from', '2026-12-01');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'First rate');
    await userEvent.click(document.querySelector('button[form=rate-form]')!);
    await waitFor(() => expect(api.last('POST', '/billing/rules')).toBeTruthy());
    expect(api.last('POST', '/billing/rules')!.body).toEqual({
      chargeHeadId: 2,
      name: 'Sinking fund - all flats',
      scopeType: 'ALL_UNITS',
      firstVersion: {
        rateType: 'FLAT_PER_UNIT',
        amountPaise: 60000,
        effectiveFrom: '2026-12-01',
        reason: 'First rate',
      },
    });
    expect(await screen.findByText('Rate saved.')).toBeInTheDocument();
  });
  it('simulates on flats without storing anything', async () => {
    const api = renderIt({
      'GET /units': list([{ id: 501, label: 'A-501' }]),
      'POST /billing/rules/simulate': ok({
        items: [
          { unitId: 501, unitLabel: 'A-501', amountPaise: 192000, computation: {}, exceptionCode: null },
          { unitId: 502, unitLabel: 'A-502', amountPaise: null, exceptionCode: 'MISSING_AREA' },
        ],
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Change rate of Maintenance/ }));
    date('Effective from', '2027-04-01');
    await userEvent.click(screen.getByRole('button', { name: 'Simulate on flats' }));
    expect(await screen.findByText('₹1,920')).toBeInTheDocument();
    expect(screen.getByText('Cannot compute (MISSING_AREA)')).toBeInTheDocument();
    expect(api.last('POST', '/billing/rules/simulate')!.body).toMatchObject({
      chargeHeadId: 1,
      unitIds: [501],
      periodStart: '2027-04-01',
    });
  });
  it('opens the history with a text status for each version', async () => {
    renderIt({
      'GET /billing/rules/7': ok(
        ruleRaw({
          versions: [
            versionRaw({ id: 1, versionNo: 1, ratePerSqftPaise: 300, effectiveTo: '2026-03-31' }),
            versionRaw({ id: 31, versionNo: 3 }),
            versionRaw({
              id: 41,
              versionNo: 4,
              status: 'REJECTED',
              rejectedReason: 'Not in the AGM minutes',
            }),
          ],
        }),
      ),
    });
    await userEvent.click(await screen.findByRole('button', { name: /History of Maintenance/ }));
    expect(await screen.findByText('Version 4')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Rejected: Not in the AGM minutes')).toBeInTheDocument();
    expect(screen.getAllByText('Approved')).toHaveLength(2);
  });
  it('deletes a never-approved rule and shows RULE_IN_USE when refused', async () => {
    const api = renderIt({
      'GET /billing/rules': list([ruleRaw({ currentVersion: null })]),
      'DELETE /billing/rules/7': err(409, 'RULE_IN_USE'),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Delete Maintenance/ }));
    await userEvent.type(screen.getByLabelText(/Reason/), 'Created by mistake');
    await userEvent.click(screen.getByRole('button', { name: 'Delete rule', hidden: false }));
    expect(await screen.findByText(/already has an approved rate/)).toBeInTheDocument();
    expect(api.last('DELETE', '/billing/rules/7')!.body).toEqual({
      reason: 'Created by mistake',
      version: 2,
    });
  });
});

describe('split rules', () => {
  it('lists, shows empty and error states', async () => {
    renderIt();
    await tab('Split rules');
    expect(await screen.findByText('Lift AMC - Wing D')).toBeInTheDocument();
    expect(screen.getByText('₹10,000 per month')).toBeInTheDocument();
  });
  it('shows an empty state', async () => {
    renderIt({ 'GET /billing/split-rules': list([]) });
    await tab('Split rules');
    expect(await screen.findByText('No split rules yet')).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    renderIt({ 'GET /billing/split-rules': err(402, 'FEATURE_NOT_IN_PLAN') });
    await tab('Split rules');
    expect(
      await screen.findByText('This is not part of your plan. Compare plans to unlock it.'),
    ).toBeInTheDocument();
  });
  it('creates a custom weight rule with an exact-paise example', async () => {
    const api = renderIt({ 'POST /billing/split-rules': ok(splitRaw({ id: 8 })) });
    await tab('Split rules');
    await userEvent.click(await screen.findByRole('button', { name: 'Add split rule' }));
    await userEvent.type(screen.getByLabelText(/^Name/), 'Terrace repair');
    await userEvent.selectOptions(screen.getByLabelText('Split by'), 'CUSTOM_WEIGHT');
    await userEvent.type(screen.getByLabelText(/^Total per month/), '10000');
    await userEvent.type(screen.getByLabelText('Weight of each flat'), '501 = 1{enter}502 = 1{enter}503 = 1');
    expect(screen.getByLabelText('Example split')).toHaveTextContent(
      '₹3,333.34 + ₹3,333.33 + ₹3,333.33 = ₹10,000',
    );
    await userEvent.click(document.querySelector('button[form=split-form]')!);
    await waitFor(() => expect(api.last('POST', '/billing/split-rules')).toBeTruthy());
    expect(api.last('POST', '/billing/split-rules')!.body).toEqual({
      name: 'Terrace repair',
      basis: 'CUSTOM_WEIGHT',
      amountSource: 'FIXED',
      fixedAmountPaise: 1000000,
      scopeType: 'ALL_UNITS',
      weights: { '501': 1, '502': 1, '503': 1 },
    });
  });
  it('rejects a weight line it cannot read', async () => {
    renderIt();
    await tab('Split rules');
    await userEvent.click(await screen.findByRole('button', { name: 'Add split rule' }));
    await userEvent.type(screen.getByLabelText(/^Name/), 'Terrace repair');
    await userEvent.selectOptions(screen.getByLabelText('Split by'), 'CUSTOM_WEIGHT');
    await userEvent.type(screen.getByLabelText(/^Total per month/), '100');
    await userEvent.type(screen.getByLabelText('Weight of each flat'), 'abc');
    await userEvent.click(document.querySelector('button[form=split-form]')!);
    expect(await screen.findByText(/is not a flat id and a weight/)).toBeInTheDocument();
  });
  it('shows SPLIT_RULE_IN_USE when archiving is refused', async () => {
    renderIt({ 'DELETE /billing/split-rules/4': err(409, 'SPLIT_RULE_IN_USE') });
    await tab('Split rules');
    await userEvent.click(await screen.findByRole('button', { name: 'Archive Lift AMC - Wing D' }));
    await userEvent.type(screen.getByLabelText(/Reason/), 'Contract ended');
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText(/uses this split rule/)).toBeInTheDocument();
  });
});

describe('late fee policy', () => {
  it('shows the current policy in words, the next one and a pending change', async () => {
    renderIt({
      'GET /billing/late-fee-policies': list([
        policyRaw({ id: 7, effectiveFrom: '2099-04-01', interestRatePct: '12.0000' }),
        policyRaw({
          id: 6,
          effectiveFrom: '2026-10-01',
          status: 'PENDING_APPROVAL',
          interestRatePct: '15.0000',
        }),
        policyRaw(),
      ]),
    });
    await tab('Late fee');
    const cur = await screen.findByLabelText('Current policy');
    expect(
      within(cur).getByText('18% a year simple interest, counted from the due date, 5 grace days'),
    ).toBeInTheDocument();
    expect(within(cur).getByText(/^12% a year/)).toBeInTheDocument();
    expect(within(cur).getByText('Waiting for approval')).toBeInTheDocument();
    expect(within(cur).getByRole('link', { name: 'Open in approvals' })).toBeInTheDocument();
  });
  it('shows an empty state and an error state', async () => {
    renderIt({ 'GET /billing/late-fee-policies': list([]) });
    await tab('Late fee');
    expect(await screen.findByText('No late fee policy yet')).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    renderIt({ 'GET /billing/late-fee-policies': err(500, 'INTERNAL_ERROR') });
    await tab('Late fee');
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
  it('refuses more than 21 percent and sends a four-decimal rate otherwise', async () => {
    const api = renderIt({
      'POST /billing/late-fee-policies': ok(policyRaw({ id: 9, status: 'PENDING_APPROVAL' })),
    });
    await tab('Late fee');
    await userEvent.click(await screen.findByRole('button', { name: 'Change policy' }));
    const rate = screen.getByLabelText(/^Interest \(% per year\)/);
    expect(rate).toHaveValue('18');
    await userEvent.clear(rate);
    await userEvent.type(rate, '36');
    date('Effective from', '2099-01-01');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Committee decision');
    await userEvent.click(document.querySelector('button[form=late-fee-form]')!);
    expect(await screen.findByText(/at most 21 percent/)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.clear(rate);
    await userEvent.type(rate, '21');
    await userEvent.click(document.querySelector('button[form=late-fee-form]')!);
    await waitFor(() => expect(api.last('POST', '/billing/late-fee-policies')).toBeTruthy());
    expect(api.last('POST', '/billing/late-fee-policies')!.body).toMatchObject({
      policyType: 'SIMPLE_INTEREST',
      interestRatePct: '21.0000',
      interestFrom: 'DUE_DATE',
      graceDays: 5,
      effectiveFrom: '2099-01-01',
    });
    expect(await screen.findByText('Policy change sent for approval.')).toBeInTheDocument();
  });
  it('shows LATE_FEE_POLICY_PENDING from the server', async () => {
    renderIt({ 'POST /billing/late-fee-policies': err(409, 'LATE_FEE_POLICY_PENDING') });
    await tab('Late fee');
    await userEvent.click(await screen.findByRole('button', { name: 'Change policy' }));
    date('Effective from', '2099-01-01');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Committee decision');
    await userEvent.click(document.querySelector('button[form=late-fee-form]')!);
    expect(await screen.findByText('A late fee change is already waiting for approval.')).toBeInTheDocument();
  });
});
