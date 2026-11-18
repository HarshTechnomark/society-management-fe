'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { billingResidentService } from '@/services/billingResident.service';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import { CategoryPicker } from './Pickers';
import { PhotoPicker, uploadPhotos } from './PhotoPicker';
import { HelpTabs } from './HelpTabs';
import { helpError, plainHelpError } from './format';

/** Raise a complaint about my flat (spec 11.6, 8.23). */
export function ReportComplaintScreen() {
  return (
    <Gate view={PERMISSIONS.resident.helpdesk.create} title="Help">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const router = useRouter();
  const toast = useToast();
  const units = useLoad(() => billingResidentService.dues(), 'dues');
  const cats = useLoad(() => svc.categories('PERSONAL'), 'cats-personal');
  const [unitId, setUnitId] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subId, setSubId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const myUnits = units.data ?? [];
  const effectiveUnit = unitId || (myUnits.length === 1 ? String(myUnits[0].unitId) : '');
  const category = (cats.data ?? []).find(c => c.id === categoryId);
  const chargeable =
    category?.isChargeable === true || category?.children.some(s => s.id === subId && s.isChargeable);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!effectiveUnit) e.unit = 'Choose your flat.';
    if (categoryId === null) e.category = 'Choose a category.';
    if (title.trim().length < 5) e.title = 'Write a short title of at least 5 characters.';
    if (description.trim().length < 10) e.description = 'Describe the problem in at least 10 characters.';
    setErrors(e);
    if (Object.keys(e).length > 0 || categoryId === null) return;
    setBusy(true);
    setProblem(null);
    try {
      const fileIds = files.length > 0 ? await uploadPhotos(files) : [];
      const t = await svc.createComplaint({
        unitId: Number(effectiveUnit),
        categoryId,
        ...(subId ? { subCategoryId: subId } : {}),
        title: title.trim(),
        description: description.trim(),
        urgency: urgent ? 'URGENT' : 'NORMAL',
        ...(fileIds.length > 0 ? { fileIds } : {}),
      });
      toast.show('Complaint sent. We will keep you updated here.');
      router.push(`/resident/help/${t.id}`);
    } catch (err) {
      setProblem(helpError(err));
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHead title="Raise a complaint" sub="Tell us what needs fixing in your flat." />
      <HelpTabs />
      <Card>
        {units.error || cats.error ? (
          <ErrorState
            error={plainHelpError(units.error ?? cats.error)}
            action={
              <button
                onClick={() => {
                  units.reload();
                  cats.reload();
                }}
              >
                Try again
              </button>
            }
          />
        ) : (
          <form
            className="grid gap-4"
            noValidate
            onSubmit={ev => {
              ev.preventDefault();
              void submit();
            }}
          >
            {problem && <Alert tone="bad">{problem}</Alert>}
            {myUnits.length > 1 && (
              <Select
                label="Flat"
                value={effectiveUnit}
                error={errors.unit}
                onChange={e => setUnitId(e.target.value)}
                options={[
                  { value: '', label: 'Choose your flat' },
                  ...myUnits.map(u => ({ value: String(u.unitId), label: u.unitLabel })),
                ]}
              />
            )}
            {myUnits.length === 1 && (
              <p className="text-[14px]">
                Flat: <b>{myUnits[0].unitLabel}</b>
              </p>
            )}
            {cats.loading ? (
              <div className="skeleton h-24 w-full" />
            ) : (
              <CategoryPicker
                categories={cats.data ?? []}
                categoryId={categoryId}
                subCategoryId={subId}
                onChange={(c, s) => {
                  setCategoryId(c);
                  setSubId(s);
                }}
                error={errors.category}
              />
            )}
            {chargeable && (
              <Alert tone="info" className="mb-0">
                Charges may apply. You will approve the estimate first.
              </Alert>
            )}
            <Input
              label="Title"
              value={title}
              maxLength={150}
              error={errors.title}
              onChange={e => setTitle(e.target.value)}
            />
            <Textarea
              label="Describe the problem"
              value={description}
              maxLength={2000}
              error={errors.description}
              onChange={e => setDescription(e.target.value)}
            />
            <div role="group" aria-label="How urgent is it?">
              <div className="mb-1 text-[13px] font-semibold">How urgent is it?</div>
              <div className="flex gap-1.5">
                {[false, true].map(u => (
                  <button
                    key={String(u)}
                    type="button"
                    aria-pressed={urgent === u}
                    onClick={() => setUrgent(u)}
                    className={cx(
                      'flex-1 rounded-full px-3 py-2 text-[13px] font-semibold',
                      urgent === u ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
                    )}
                  >
                    {u ? 'Urgent' : 'Normal'}
                  </button>
                ))}
              </div>
            </div>
            <PhotoPicker files={files} onChange={setFiles} disabled={busy} />
            <Button type="submit" block loading={busy}>
              Send complaint
            </Button>
          </form>
        )}
      </Card>
    </Page>
  );
}
