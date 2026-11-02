'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { usePermission } from '@/hooks/usePermission';
import { societySetupService } from '@/services/society-setup.service';
import { GeneratorDialog } from './GeneratorDialog';
import { ImportDialog } from './ImportDialog';
import { setupError } from './format';

const U = PERMISSIONS.residents.units;

/** Generate, Import and Export buttons shared by the buildings and flats pages (spec 11.6). */
export function StructureActions({ buildingId, onChanged }: { buildingId?: number; onChanged: () => void }) {
  const toast = useToast();
  const mayCreate = usePermission(U.create);
  const mayImport = usePermission(U.import);
  const mayExport = usePermission(U.export);
  const hasGenerator = useFeature('property.bulk_unit_generator');
  const hasImport = useFeature('property.spreadsheet_import');
  const hasExport = useFeature('property.export_structure');
  const canCreate = mayCreate && hasGenerator;
  const canImport = mayImport && hasImport;
  const canExport = mayExport && hasExport;
  const [dlg, setDlg] = useState<'gen' | 'import' | null>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      await societySetupService.exportUnits({ status: 'ACTIVE', ...(buildingId ? { buildingId } : {}) });
      toast.show('Export started. You will be notified when the file is ready.');
    } catch (e) {
      toast.show(setupError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {canCreate && (
        <Button variant="glass" onClick={() => setDlg('gen')}>
          Generate units
        </Button>
      )}
      {canImport && (
        <Button variant="glass" onClick={() => setDlg('import')}>
          Import units
        </Button>
      )}
      {canExport && (
        <Button variant="glass" loading={busy} onClick={doExport}>
          Export units
        </Button>
      )}
      <GeneratorDialog open={dlg === 'gen'} onClose={() => setDlg(null)} onDone={onChanged} />
      <ImportDialog open={dlg === 'import'} onClose={() => setDlg(null)} onDone={onChanged} />
    </>
  );
}
