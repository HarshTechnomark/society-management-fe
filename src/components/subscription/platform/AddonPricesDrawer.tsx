'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { Addon } from '@/types/subscriptions';
import { paiseToRupeesText, rankRange, rupeesToPaise, subscriptionErrorText } from '../format';

export const addonUnit = (a: Pick<Addon, 'billingType'>) =>
  a.billingType === 'RECURRING' ? 'per month' : 'per pack';

/** Spec 11.1 **Add-on prices** drawer: price with unit, plans it is sold to, on-sale switch and price edit. */
export function AddonPricesDrawer({
  open,
  onClose,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  if (!open) return null;
  return <Body onClose={onClose} canEdit={canEdit} />;
}

function Body({ onClose, canEdit }: { onClose: () => void; canEdit: boolean }) {
  const toast = useToast();
  const list = useLoad(() => subscriptionsService.platformAddons());
  const [toggling, setToggling] = useState<Addon | null>(null);
  const [editing, setEditing] = useState<Addon | null>(null);

  const update = async (a: Addon, body: { isOnSale?: boolean; pricePaise?: number }, reason: string) => {
    try {
      await subscriptionsService.updateAddon(a.id, { ...body, reason, version: a.version });
      toast.show('Add-on updated.');
      setToggling(null);
      setEditing(null);
      list.reload();
    } catch (e) {
      toast.show(subscriptionErrorText(e), 'error');
    }
  };

  return (
    <Drawer
      open
      size={640}
      onClose={onClose}
      title="Add-on store prices"
      description="Societies buy these inside their admin panel. Price changes never touch existing purchases."
    >
      {list.error ? (
        <ErrorState error={list.error} title="Add-ons could not be loaded" />
      ) : !list.data ? (
        <div className="skeleton h-48 w-full" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px]">
            <caption className="sr-only">Add-on prices</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[12px] uppercase text-muted">
                <th scope="col" className="px-2 py-2">
                  Add-on
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Price
                </th>
                <th scope="col" className="px-2 py-2">
                  Available to plans
                </th>
                <th scope="col" className="px-2 py-2 text-center">
                  On sale
                </th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.map(a => (
                <tr key={a.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-2 py-2">
                    <b>{a.name}</b>
                    <div className="font-mono text-[12px] text-muted">{a.code}</div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <b>{inr(a.pricePaise)}</b>
                    <div className="text-[12px] text-muted">{addonUnit(a)}</div>
                  </td>
                  <td className="px-2 py-2 text-[13px]">{rankRange(a.minTierRank, a.maxTierRank)}</td>
                  <td className="px-2 py-2 text-center">
                    <Switch
                      checked={a.isOnSale}
                      label={`${a.name} on sale`}
                      disabled={!canEdit}
                      onChange={() => setToggling(a)}
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {canEdit && (
                      <Button size="xs" variant="glass" onClick={() => setEditing(a)}>
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toggling && (
        <ConfirmReason
          open
          title={`${toggling.isOnSale ? 'Take off sale' : 'Put on sale'}: ${toggling.name}`}
          description={
            toggling.isOnSale
              ? 'Societies can no longer buy it. Existing purchases continue.'
              : 'Societies on the listed plans can buy it.'
          }
          confirmLabel="Confirm"
          variant="primary"
          onCancel={() => setToggling(null)}
          onConfirm={reason => update(toggling, { isOnSale: !toggling.isOnSale }, reason)}
        />
      )}
      {editing && (
        <PriceDialog
          addon={editing}
          onCancel={() => setEditing(null)}
          onSave={(pricePaise, reason) => update(editing, { pricePaise }, reason)}
        />
      )}
    </Drawer>
  );
}

function PriceDialog({
  addon,
  onCancel,
  onSave,
}: {
  addon: Addon;
  onCancel: () => void;
  onSave: (pricePaise: number, reason: string) => Promise<void>;
}) {
  const [price, setPrice] = useState(paiseToRupeesText(addon.pricePaise));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ price?: string; reason?: string }>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = rupeesToPaise(price);
    const e: typeof errors = {};
    if (p === null || p < 100 || p > 10_000_000) e.price = 'Enter a price from ₹1 to ₹1,00,000.';
    const r = reason.trim();
    if (r.length < 5 || r.length > 500) e.reason = 'Enter between 5 and 500 characters.';
    setErrors(e);
    if (e.price || e.reason || p === null) return;
    if (p === addon.pricePaise) {
      setErrors({ price: 'This is the current price.' });
      return;
    }
    setBusy(true);
    try {
      await onSave(p, r);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onCancel}
      title={`Edit price: ${addon.name}`}
      description="Only new purchases use the new price."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Save price
          </Button>
        </>
      }
    >
      {addon.activeCount ? (
        <Alert tone="info">{addon.activeCount} live purchases keep the price they were bought at.</Alert>
      ) : null}
      <Input
        label={`Price (₹, ${addonUnit(addon)})`}
        inputMode="decimal"
        value={price}
        onChange={e => setPrice(e.target.value)}
        error={errors.price}
        required
      />
      <Input
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        error={errors.reason}
        required
      />
    </Modal>
  );
}
