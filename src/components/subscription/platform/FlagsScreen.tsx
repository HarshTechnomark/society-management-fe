'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { FeatureFlag, FlagType } from '@/types/subscriptions';
import { subscriptionErrorText } from '../format';
import { FlagCreateModal } from './FlagCreateModal';
import { FlagEditDrawer } from './FlagEditDrawer';
import { FlagOverridesDrawer } from './FlagOverridesDrawer';
import { FLAG_TYPES, FLAG_TYPE_LABEL, FLAG_TYPE_TONE, typeText } from './flags';

/** Spec 11.2: Super Admin › Feature flags. */
export function FlagsScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.featureFlags.view);
  const canCreate = usePermission(PERMISSIONS.platform.featureFlags.create);
  const canEdit = usePermission(PERMISSIONS.platform.featureFlags.edit);
  const toast = useToast();
  const flags = useLoad(() => subscriptionsService.flags());
  const [type, setType] = useState<FlagType | 'ALL'>('ALL');
  const [toggling, setToggling] = useState<FeatureFlag | null>(null);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [overridesFor, setOverridesFor] = useState<FeatureFlag | null>(null);
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => flags.data?.data ?? [], [flags.data]);
  const rows = type === 'ALL' ? all : all.filter(f => f.type === type);
  const count = (t: FlagType | 'ALL') => (t === 'ALL' ? all.length : all.filter(f => f.type === t).length);

  const toggle = async (f: FeatureFlag, reason: string) => {
    try {
      await subscriptionsService.toggleFlag(f.id, { isEnabled: !f.isEnabled, reason, version: f.version });
      toast.show(
        `${f.flagKey} is ${f.isEnabled ? 'off' : 'on'}.`,
        f.type === 'KILL_SWITCH' && !f.isEnabled ? 'warning' : 'success',
      );
      setToggling(null);
      flags.reload();
    } catch (e) {
      toast.show(subscriptionErrorText(e), 'error');
    }
  };

  const columns: Column<FeatureFlag>[] = [
    {
      key: 'key',
      label: 'Flag',
      sortValue: f => f.flagKey,
      render: f => (
        <span className="block min-w-[220px]">
          <span className="block font-mono font-bold">{f.flagKey}</span>
          <span className="block text-[13px] text-muted">{f.description}</span>
          {(f.ownerTeam || f.expiresOn || f.isClientVisible) && (
            <span className="block text-[12px] text-muted">
              {[
                f.ownerTeam ? `Owner ${f.ownerTeam}` : null,
                f.expiresOn ? `remove by ${shortDate(f.expiresOn)}` : null,
                f.isClientVisible ? 'visible to apps' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortValue: f => f.type,
      render: f => <Chip tone={FLAG_TYPE_TONE[f.type]}>{typeText(f)}</Chip>,
    },
    {
      key: 'enabled',
      label: 'Default',
      sortValue: f => (f.isEnabled ? 1 : 0),
      render: f => (
        <span className="flex items-center gap-2">
          <Switch
            checked={f.isEnabled}
            label={`Toggle ${f.flagKey}`}
            disabled={!canEdit}
            onChange={() => setToggling(f)}
          />
          <span className={cx('text-[13px] font-semibold', f.isEnabled ? 'text-ok' : 'text-faint')}>
            {f.isEnabled ? 'On' : 'Off'}
          </span>
        </span>
      ),
    },
    {
      key: 'rollout',
      label: 'Rollout',
      render: f =>
        f.type === 'PERCENTAGE' ? (
          <span className="flex min-w-[110px] items-center gap-2">
            <span
              className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(20,35,44,0.12)]"
              role="progressbar"
              aria-label={`${f.flagKey} rollout`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={f.rolloutPercent ?? 0}
            >
              <span className="block h-full bg-navy" style={{ width: `${f.rolloutPercent ?? 0}%` }} />
            </span>
            <b className="w-9 text-[13px]">{f.rolloutPercent ?? 0}%</b>
          </span>
        ) : (
          <span className="text-faint">-</span>
        ),
    },
    {
      key: 'overrides',
      label: 'Overrides',
      sortValue: f => f.overrideCount,
      render: f => (
        <Button
          size="xs"
          variant="ghost"
          aria-label={`${f.overrideCount} overrides for ${f.flagKey}`}
          onClick={() => setOverridesFor(f)}
        >
          {f.overrideCount} ›
        </Button>
      ),
    },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      className: 'text-right',
      render: f =>
        canEdit ? (
          <Button size="xs" variant="glass" aria-label={`Edit ${f.flagKey}`} onClick={() => setEditing(f)}>
            Edit
          </Button>
        ) : null,
    },
  ];

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Feature flags" />
        <Card>
          <EmptyState title="You do not have access to this page" />
        </Card>
      </Page>
    );

  const segments: (FlagType | 'ALL')[] = ['ALL', ...FLAG_TYPES];
  return (
    <Page>
      <PageHead
        title="Feature flags"
        sub="Global, plan, tenant, percentage and kill-switch flags. Every change needs a reason and is audited."
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              Create flag
            </Button>
          )
        }
      />
      <Card>
        <div role="group" aria-label="Flag type" className="mb-3 flex flex-wrap gap-1.5">
          {segments.map(s => (
            <button
              key={s}
              type="button"
              aria-pressed={type === s}
              onClick={() => setType(s)}
              className={cx(
                'h-8 rounded-full px-3 text-[13px] font-semibold',
                type === s ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-ink hover:bg-white/80',
              )}
            >
              {s === 'ALL' ? 'All' : FLAG_TYPE_LABEL[s]} <span className="opacity-70">{count(s)}</span>
            </button>
          ))}
        </div>
        <DataTable
          caption="Feature flags"
          columns={columns}
          rows={rows}
          rowKey={f => f.id}
          loading={flags.loading && !flags.data}
          error={flags.error}
          onRetry={flags.reload}
          searchText={f => `${f.flagKey} ${f.description}`}
          searchLabel="Search flags"
          initialSort={{ key: 'key', dir: 'asc' }}
          empty={{ title: 'No flags match' }}
        />
      </Card>

      {toggling && (
        <ConfirmReason
          open
          title={`${toggling.isEnabled ? 'Turn off' : 'Turn on'} ${toggling.flagKey}?`}
          description={
            toggling.type === 'KILL_SWITCH'
              ? toggling.isEnabled
                ? 'Releasing the kill switch resumes normal behaviour.'
                : 'Engaging a kill switch changes behaviour for every society immediately. You will be asked to confirm it is you.'
              : toggling.description
          }
          confirmLabel={toggling.isEnabled ? 'Turn off' : 'Turn on'}
          variant={toggling.type === 'KILL_SWITCH' && !toggling.isEnabled ? 'danger' : 'primary'}
          onCancel={() => setToggling(null)}
          onConfirm={reason => toggle(toggling, reason)}
        />
      )}
      {editing && (
        <FlagEditDrawer
          flag={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            flags.reload();
          }}
        />
      )}
      {overridesFor && (
        <FlagOverridesDrawer
          flag={overridesFor}
          canEdit={canEdit}
          onClose={() => setOverridesFor(null)}
          onChanged={flags.reload}
        />
      )}
      {creating && (
        <FlagCreateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            flags.reload();
          }}
        />
      )}
    </Page>
  );
}
