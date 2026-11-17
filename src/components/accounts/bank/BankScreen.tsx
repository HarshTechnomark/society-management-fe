'use client';
import Link from 'next/link';
import { useState } from 'react';
import { accountsError, plainAccountsError } from '@/components/accounts/format';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { accountsBankService } from '@/services/accountsBank.service';
import type { BankAccount } from '@/types/accountsBank';
import { BankCard } from './BankCard';
import { BankFormDialog } from './BankFormDialog';

const B = PERMISSIONS.finance.bank;

/** Bank accounts (spec 11.3, 8.14): masked numbers, add, change, verify by a second person, collection account, close. */
export function BankScreen() {
  return (
    <Gate view={B.view} feature="accounting.simple_cash_book" title="Bank accounts">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const toast = useToast();
  const canEdit = usePermission(B.edit);
  const canApprove = usePermission(B.approve);
  const multi = useFeature('accounting.bank_and_cash_accounts');
  const list = useLoad(() => accountsBankService.list());
  const [form, setForm] = useState<{ account: BankAccount | null } | null>(null);
  const [closing, setClosing] = useState<BankAccount | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const all = list.data ?? [];
  const active = all.filter(a => a.status === 'ACTIVE');
  const locked = active.length >= 1 && !multi;
  const done = () => {
    setForm(null);
    list.reload();
  };

  return (
    <Page>
      <PageHead
        title="Bank accounts"
        sub="The society accounts, with numbers hidden except the last four digits."
        actions={
          <>
            <Link href="/admin/accounts/funds" className={buttonClasses('glass', 'md')}>
              Funds
            </Link>
            {canEdit && (
              <Button disabled={locked} onClick={() => setForm({ account: null })}>
                Add bank account {locked && <Chip tone="gold">Premium</Chip>}
              </Button>
            )}
          </>
        }
      />
      {locked && canEdit && (
        <Alert tone="info">
          A second bank account, cash and petty cash accounts are part of the Premium plan.
        </Alert>
      )}
      {list.error != null ? (
        <ErrorState
          error={plainAccountsError(list.error)}
          action={
            <Button size="sm" onClick={list.reload}>
              Try again
            </Button>
          }
        />
      ) : list.loading ? (
        <div aria-busy="true" aria-label="Loading">
          {[0, 1].map(i => (
            <div key={i} className="skeleton mb-3 h-40 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          title="No bank account yet"
          text="Add the society bank account to record deposits and reconcile."
        />
      ) : (
        <div className="grid gap-4">
          {all.map(a => (
            <BankCard
              key={a.id}
              account={a}
              canEdit={canEdit}
              canApprove={canApprove}
              onEdit={() => setForm({ account: a })}
              onClose={() => {
                setCloseError(null);
                setClosing(a);
              }}
              onChanged={list.reload}
            />
          ))}
        </div>
      )}
      {form && (
        <BankFormDialog
          account={form.account}
          first={active.length === 0}
          onClose={() => setForm(null)}
          onSaved={done}
        />
      )}
      {closing && (
        <ConfirmReason
          open
          title={`Close ${closing.displayName}?`}
          description={
            closeError ??
            'Its book balance must be zero, and the collection account cannot be closed until another one is chosen.'
          }
          confirmLabel="Close account"
          onCancel={() => setClosing(null)}
          onConfirm={async reason => {
            try {
              await accountsBankService.close(closing.id, { reason, version: closing.version });
              toast.show('Bank account closed');
              setClosing(null);
              list.reload();
            } catch (e) {
              setCloseError(accountsError(e));
            }
          }}
        />
      )}
    </Page>
  );
}
