'use client';
import { useState } from 'react';
import { accountsError, fieldErrors } from '@/components/accounts/format';
import { todayIso } from '@/components/payments/ops/format';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { accountsBankService } from '@/services/accountsBank.service';
import type { BankAccount, BankAccountInput, BankKind } from '@/types/accountsBank';

/** Opening balance typed in rupees (may be negative) to signed paise; null when not a valid amount. */
export function signedPaise(text: string): number | null {
  const t = text.replace(/[,\s₹]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Add a bank account, or change one (step-up is asked by the API client; a changed number or IFSC needs verifying again). */
export function BankFormDialog({
  account,
  first,
  onClose,
  onSaved,
}: {
  account: BankAccount | null;
  first: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [branchName, setBranchName] = useState(account?.branchName ?? '');
  const [ifsc, setIfsc] = useState(account?.ifsc ?? '');
  const [kind, setKind] = useState<BankKind>(account?.accountKind ?? 'CURRENT');
  const [holder, setHolder] = useState(account?.accountHolderName ?? '');
  const [number, setNumber] = useState('');
  const [confirm, setConfirm] = useState('');
  const [opening, setOpening] = useState('');
  const [openingOn, setOpeningOn] = useState(todayIso());
  const [collection, setCollection] = useState(first);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    const code = ifsc.trim().toUpperCase();
    if (displayName.trim().length < 2 || displayName.trim().length > 60)
      e.displayName = 'Enter a name of 2 to 60 characters.';
    if (!account && (bankName.trim().length < 2 || bankName.trim().length > 100))
      e.bankName = 'Enter the bank name.';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code))
      e.ifsc = 'Enter the 11-character IFSC, for example HDFC0001234.';
    if (holder.trim().length < 2) e.accountHolderName = 'Enter the name of the account holder.';
    const changingNumber = !account || number !== '' || confirm !== '';
    if (changingNumber) {
      if (!/^\d{9,18}$/.test(number)) e.accountNumber = 'Enter the account number: 9 to 18 digits.';
      if (confirm !== number) e.confirmAccountNumber = 'The two account numbers do not match.';
    }
    let openingPaise: number | null = 0;
    if (!account && opening.trim() !== '') {
      openingPaise = signedPaise(opening);
      if (openingPaise === null) e.openingBalancePaise = 'Enter an amount in rupees.';
      else if (openingPaise !== 0 && (!openingOn || openingOn > todayIso()))
        e.openingBalanceDate = 'Choose a date up to today.';
    }
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      let saved = 'Bank account added';
      if (account) {
        const updated = await accountsBankService.update(account.id, {
          displayName: displayName.trim(),
          branchName: branchName.trim() || null,
          accountHolderName: holder.trim(),
          ifsc: code,
          ...(changingNumber ? { accountNumber: number, confirmAccountNumber: confirm } : {}),
          version: account.version,
        });
        // Say what the server did: the verification is reset only when it answers so.
        saved =
          account.verificationStatus === 'VERIFIED' && updated.verificationStatus !== 'VERIFIED'
            ? 'Bank account saved. It needs to be verified again.'
            : 'Bank account saved.';
      } else {
        const body: BankAccountInput = {
          displayName: displayName.trim(),
          bankName: bankName.trim(),
          ...(branchName.trim() ? { branchName: branchName.trim() } : {}),
          ifsc: code,
          accountKind: kind,
          accountHolderName: holder.trim(),
          accountNumber: number,
          confirmAccountNumber: confirm,
          isCollectionAccount: collection,
          ...(openingPaise ? { openingBalancePaise: openingPaise, openingBalanceDate: openingOn } : {}),
        };
        await accountsBankService.create(body);
      }
      toast.show(saved);
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFailed(accountsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={account ? 'Change bank account' : 'Add bank account'}
      description="You confirm it is you first. Another committee member then verifies the account."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            {account ? 'Verify and save' : 'Add account'}
          </Button>
        </>
      }
    >
      <div className="grid gap-1">
        {failed && <Alert tone="bad">{failed}</Alert>}
        <Input
          label="Name in the books"
          value={displayName}
          error={errors.displayName}
          hint="For example HDFC Current"
          onChange={e => setDisplayName(e.target.value)}
          required
        />
        {!account && (
          <Input
            label="Bank"
            value={bankName}
            error={errors.bankName}
            onChange={e => setBankName(e.target.value)}
            required
          />
        )}
        <Input
          label="Branch"
          value={branchName}
          error={errors.branchName}
          onChange={e => setBranchName(e.target.value)}
        />
        <Input
          label="IFSC"
          value={ifsc}
          error={errors.ifsc}
          onChange={e => setIfsc(e.target.value.toUpperCase())}
          maxLength={11}
          required
        />
        {!account && (
          <Select
            label="Type of account"
            value={kind}
            onChange={e => setKind(e.target.value as BankKind)}
            options={[
              { value: 'CURRENT', label: 'Current' },
              { value: 'SAVINGS', label: 'Savings' },
            ]}
          />
        )}
        <Input
          label="Account holder"
          value={holder}
          error={errors.accountHolderName}
          onChange={e => setHolder(e.target.value)}
          required
        />
        <Input
          label={account ? 'New account number' : 'Account number'}
          inputMode="numeric"
          autoComplete="off"
          value={number}
          error={errors.accountNumber}
          hint={account ? 'Leave blank to keep the current number.' : undefined}
          onChange={e => setNumber(e.target.value.replace(/\D/g, ''))}
          required={!account}
        />
        <Input
          label="Confirm account number"
          inputMode="numeric"
          autoComplete="off"
          value={confirm}
          error={errors.confirmAccountNumber}
          onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))}
          required={!account || number !== ''}
        />
        {!account && (
          <>
            <Input
              label="Opening balance (₹)"
              inputMode="decimal"
              value={opening}
              error={errors.openingBalancePaise}
              hint="Optional. Use a minus sign for an overdraft."
              onChange={e => setOpening(e.target.value)}
            />
            {opening.trim() !== '' && (
              <Input
                label="Opening balance date"
                type="date"
                value={openingOn}
                max={todayIso()}
                error={errors.openingBalanceDate}
                onChange={e => setOpeningOn(e.target.value)}
              />
            )}
            <Checkbox
              label="Online payments are settled into this account (collection account)"
              checked={collection}
              onChange={e => setCollection(e.target.checked)}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
