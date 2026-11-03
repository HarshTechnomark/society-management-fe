'use client';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { societySetupService } from '@/services/society-setup.service';
import type { Holiday, SettingItem } from '@/types/societySetup';
import { ConfirmDialog } from './ConfirmDialog';
import { Gate } from './Gate';
import { fieldErrors, setupError } from './format';

const TYPES = [
  { value: 'NATIONAL', label: 'National' },
  { value: 'FESTIVAL', label: 'Festival' },
  { value: 'SOCIETY', label: 'Society' },
  { value: 'OTHER', label: 'Other' },
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const holidayDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** Settings > Holidays (spec 11.9): year list, add, suggestions, weekly off days and office hours. */
export function HolidaysScreen() {
  return (
    <Gate view={PERMISSIONS.settings.society.view} feature="property.society_settings" title="Holidays">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canEdit = usePermission(PERMISSIONS.settings.society.edit);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [edit, setEdit] = useState<Holiday | 'new' | null>(null);
  const [sheet, setSheet] = useState(false);
  const [del, setDel] = useState<Holiday | null>(null);
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => societySetupService.holidays(year), year);

  const columns: Column<Holiday>[] = [
    { key: 'date', label: 'Date', render: h => holidayDate(h.holidayDate), sortValue: h => h.holidayDate },
    { key: 'name', label: 'Name', render: h => h.name },
    {
      key: 'type',
      label: 'Type',
      render: h => TYPES.find(t => t.value === h.holidayType)?.label ?? h.holidayType,
    },
    {
      key: 'closed',
      label: 'Office',
      render: h => (
        <Chip tone={h.isOfficeClosed ? 'warn' : 'neutral'}>{h.isOfficeClosed ? 'Closed' : 'Open'}</Chip>
      ),
    },
  ];
  if (canEdit)
    columns.push({
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      render: h => (
        <span className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="xs" variant="glass" aria-label={`Edit ${h.name}`} onClick={() => setEdit(h)}>
            Edit
          </Button>
          <Button size="xs" variant="ghost" aria-label={`Delete ${h.name}`} onClick={() => setDel(h)}>
            Delete
          </Button>
        </span>
      ),
    });

  return (
    <Page>
      <PageHead
        title="Holidays"
        sub="Office closed days. Due dates and service timers skip them."
        actions={
          canEdit && (
            <>
              <Button onClick={() => setEdit('new')}>Add holiday</Button>
              <Button variant="glass" onClick={() => setSheet(true)}>
                Add suggested holidays
              </Button>
            </>
          )
        }
      />
      <Card>
        <div className="max-w-[180px]">
          <Select
            label="Year"
            value={String(year)}
            onChange={e => setYear(Number(e.target.value))}
            options={[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(y => ({
              value: String(y),
              label: String(y),
            }))}
          />
        </div>
        <DataTable
          caption="Holidays"
          columns={columns}
          rows={data?.items ?? []}
          rowKey={h => h.id}
          loading={loading}
          error={error}
          onRetry={reload}
          pageSize={50}
          initialSort={{ key: 'date', dir: 'asc' }}
          empty={{ title: `No holidays in ${year}`, text: 'Add a holiday or pick from the suggested list.' }}
        />
      </Card>
      <OfficeCard canEdit={canEdit} weekly={data?.weeklyOffDays} onSaved={reload} />
      {edit && (
        <HolidayModal
          key={edit === 'new' ? 'new' : edit.id}
          holiday={edit === 'new' ? null : edit}
          year={year}
          onClose={() => setEdit(null)}
          onSaved={reload}
        />
      )}
      {sheet && <SuggestionsModal year={year} onClose={() => setSheet(false)} onSaved={reload} />}
      <ConfirmDialog
        open={!!del}
        title={`Delete ${del?.name ?? 'holiday'}?`}
        confirmLabel="Delete"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          try {
            await societySetupService.deleteHoliday(del!.id);
            toast.show('Holiday deleted.');
            reload();
          } catch (e) {
            toast.show(setupError(e), 'error');
          }
          setDel(null);
        }}
      />
    </Page>
  );
}

function HolidayModal({
  holiday,
  year,
  onClose,
  onSaved,
}: {
  holiday: Holiday | null;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState({
    date: holiday?.holidayDate ?? `${year}-01-01`,
    name: holiday?.name ?? '',
    type: holiday?.holidayType ?? 'SOCIETY',
    closed: holiday?.isOfficeClosed ?? true,
    notes: holiday?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.holidayDate = 'Choose a date.';
    if (v.name.trim().length < 2) e.name = 'Enter a name (at least 2 characters).';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormError(null);
    const body = {
      holidayDate: v.date,
      name: v.name.trim(),
      holidayType: v.type,
      isOfficeClosed: v.closed,
      notes: v.notes.trim() || null,
    };
    try {
      if (holiday) await societySetupService.updateHoliday(holiday.id, { ...body, version: holiday.version });
      else await societySetupService.createHoliday(body);
      toast.show(holiday ? 'Holiday saved.' : 'Holiday added.');
      onSaved();
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(setupError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={holiday ? 'Edit holiday' : 'Add holiday'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            {holiday ? 'Save changes' : 'Add holiday'}
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <Input
        label="Date"
        type="date"
        value={v.date}
        onChange={e => setV(x => ({ ...x, date: e.target.value }))}
        error={errors.holidayDate}
      />
      <Input
        label="Name"
        value={v.name}
        onChange={e => setV(x => ({ ...x, name: e.target.value }))}
        error={errors.name}
        maxLength={80}
      />
      <Select
        label="Type"
        value={v.type}
        onChange={e => setV(x => ({ ...x, type: e.target.value as Holiday['holidayType'] }))}
        options={TYPES}
      />
      <Checkbox
        label="Office is closed"
        checked={v.closed}
        onChange={e => setV(x => ({ ...x, closed: e.target.checked }))}
      />
      <Input
        label="Notes"
        value={v.notes}
        onChange={e => setV(x => ({ ...x, notes: e.target.value }))}
        error={errors.notes}
        maxLength={300}
      />
    </Modal>
  );
}

function SuggestionsModal({
  year,
  onClose,
  onSaved,
}: {
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { data, error, loading } = useLoad(() => societySetupService.holidaySuggestions(year), year);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const free = (data ?? []).filter(s => !s.alreadyAdded);
  const add = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const r = await societySetupService.bulkHolidays(
        free
          .filter(s => picked.has(s.holidayDate))
          .map(s => ({
            holidayDate: s.holidayDate,
            name: s.name,
            holidayType: s.holidayType,
            isOfficeClosed: true,
          })),
      );
      toast.show(`${r.created} holidays added${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}.`);
      onSaved();
      onClose();
    } catch (e) {
      setFormError(setupError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Suggested holidays ${year}`}
      description="Festival dates change every year. Check them before you add."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={picked.size === 0} onClick={add}>
            Add selected ({picked.size})
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      {error ? (
        <Alert tone="bad">{setupError(error)}</Alert>
      ) : loading ? (
        <div className="skeleton h-24 w-full" aria-busy="true" />
      ) : (data ?? []).length === 0 ? (
        <p className="text-[14px] text-muted">No suggestions for {year}.</p>
      ) : (
        <>
          <Checkbox
            label="Select all"
            checked={free.length > 0 && picked.size === free.length}
            onChange={e => setPicked(e.target.checked ? new Set(free.map(s => s.holidayDate)) : new Set())}
          />
          {(data ?? []).map(s => (
            <Checkbox
              key={s.holidayDate}
              label={`${s.name} · ${holidayDate(s.holidayDate)}${s.alreadyAdded ? ' (already added)' : ''}`}
              disabled={s.alreadyAdded}
              checked={s.alreadyAdded || picked.has(s.holidayDate)}
              onChange={e =>
                setPicked(p => {
                  const n = new Set(p);
                  if (e.target.checked) n.add(s.holidayDate);
                  else n.delete(s.holidayDate);
                  return n;
                })
              }
            />
          ))}
        </>
      )}
    </Modal>
  );
}

/** Weekly off days and office hours: the `office.*` settings. */
function OfficeCard({
  canEdit,
  weekly,
  onSaved,
}: {
  canEdit: boolean;
  weekly: number[] | undefined;
  onSaved: () => void;
}) {
  const { data, error, loading, reload } = useLoad(() => societySetupService.settings('office'));
  if (error)
    return (
      <Card title="Office days and hours" className="mt-4">
        <Alert tone="bad">{setupError(error)}</Alert>
      </Card>
    );
  if (loading || !data)
    return (
      <Card title="Office days and hours" className="mt-4">
        <div className="skeleton h-20 w-full" aria-busy="true" />
      </Card>
    );
  return (
    <OfficeForm
      items={data}
      canEdit={canEdit}
      weekly={weekly}
      onSaved={() => {
        reload();
        onSaved();
      }}
    />
  );
}

function OfficeForm({
  items,
  canEdit,
  weekly,
  onSaved,
}: {
  items: SettingItem[];
  canEdit: boolean;
  weekly: number[] | undefined;
  onSaved: () => void;
}) {
  const toast = useToast();
  const get = (k: string) => items.find(i => i.key === k);
  const off = get('office.weeklyOffDays');
  const open = get('office.openTime');
  const close = get('office.closeTime');
  const [days, setDays] = useState<number[]>((off?.value as number[] | undefined) ?? weekly ?? [0]);
  const [openT, setOpenT] = useState(String(open?.value ?? '09:00'));
  const [closeT, setCloseT] = useState(String(close?.value ?? '18:00'));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const can = canEdit && !!off?.canEdit;
  const changes = useMemo(() => {
    const c = [];
    const sorted = [...days].sort();
    if (off && JSON.stringify(sorted) !== JSON.stringify(off.value))
      c.push({ key: off.key, value: sorted, version: off.version });
    if (open && openT !== open.value) c.push({ key: open.key, value: openT, version: open.version });
    if (close && closeT !== close.value) c.push({ key: close.key, value: closeT, version: close.version });
    return c;
  }, [days, openT, closeT, off, open, close]);
  const toggle = (d: number) => setDays(x => (x.includes(d) ? x.filter(y => y !== d) : [...x, d]));
  const save = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await societySetupService.saveSettings(changes);
      toast.show('Office days and hours saved.');
      onSaved();
    } catch (e) {
      setFormError(setupError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title="Office days and hours"
      sub="Weekly off days count as non-working days, like holidays."
      className="mt-4"
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <fieldset className="mb-3">
        <legend className="mb-2 text-[13px] font-semibold">Weekly off days (at most 2)</legend>
        <div className="flex flex-wrap gap-x-4">
          {DAYS.map((d, i) => (
            <Checkbox
              key={d}
              label={d}
              className="mb-1"
              checked={days.includes(i)}
              disabled={!can || (!days.includes(i) && days.length >= 2)}
              onChange={() => toggle(i)}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-x-3 sm:max-w-sm">
        <Input
          label="Office opens"
          type="time"
          value={openT}
          onChange={e => setOpenT(e.target.value)}
          disabled={!can}
        />
        <Input
          label="Office closes"
          type="time"
          value={closeT}
          onChange={e => setCloseT(e.target.value)}
          disabled={!can}
        />
      </div>
      {can && (
        <div className="flex justify-end">
          <Button loading={busy} disabled={changes.length === 0} onClick={save}>
            Save office hours
          </Button>
        </div>
      )}
    </Card>
  );
}
