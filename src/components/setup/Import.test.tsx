import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureFileUploader } from '@/lib/fileUpload';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { importReport } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { ImportDialog, importPoll } from './ImportDialog';

vi.mock('next/navigation', () => navigationMock());

const onDone = vi.fn();
const upload = vi.fn(async () => ({ fileId: 5 }));

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, mode?: 'UPSERT') {
  signIn();
  const api = mockApi(routes);
  render(
    <ToastProvider>
      <ImportDialog open onClose={vi.fn()} onDone={onDone} defaultMode={mode} />
    </ToastProvider>,
  );
  return api;
}

async function chooseFile() {
  const dlg = await screen.findByRole('dialog');
  await userEvent.upload(
    within(dlg).getByLabelText('File'),
    new File(['a,b'], 'flats.csv', { type: 'text/csv' }),
  );
  await userEvent.click(within(dlg).getByRole('button', { name: 'Check file' }));
  return dlg;
}

describe('Import units flow (11.7)', () => {
  beforeEach(() => {
    resetAll();
    onDone.mockReset();
    upload.mockClear();
    importPoll.ms = 20;
    configureFileUploader({ upload });
  });

  it('offers the template, the two modes and the missing towers option', async () => {
    renderIt();
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('link', { name: /Download template/ })).toHaveAttribute(
      'href',
      '/templates/units-template.csv',
    );
    const modes = within(dlg).getByRole('combobox', { name: 'What should the import do?' });
    expect(
      within(modes)
        .getAllByRole('option')
        .map(o => o.textContent),
    ).toEqual(['Create only', 'Create and update']);
    expect(within(dlg).getByRole('checkbox', { name: 'Create missing towers' })).not.toBeChecked();
  });

  it('cannot start without a file or an uploader', async () => {
    configureFileUploader(null);
    renderIt();
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('button', { name: 'Check file' })).toBeDisabled();
    expect(within(dlg).getByText(/File upload is not available yet/)).toBeInTheDocument();
  });

  it('uploads, starts the dry run, polls and shows the report', async () => {
    const api = renderIt({
      'POST /units/imports': ok({ importId: 4411, status: 'VALIDATING' }),
      'GET /units/imports/4411': [ok(importReport({ status: 'VALIDATING' })), ok(importReport())],
    });
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'What should the import do?' }),
      'UPSERT',
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Create missing towers' }));
    const dlg = await chooseFile();
    expect(await within(dlg).findByText('Checking your file...')).toBeInTheDocument();
    const report = await within(dlg).findByRole('region', { name: 'Import report' });
    expect(api.last('POST', '/units/imports')!.body).toEqual({
      fileId: 5,
      mode: 'UPSERT',
      createMissingBuildings: true,
    });
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'IMPORT_FILE');
    expect(within(report).getByText('Create 280')).toBeInTheDocument();
    expect(within(report).getByText('Update 24')).toBeInTheDocument();
    expect(within(report).getByText('Unchanged 3')).toBeInTheDocument();
    expect(within(report).getByText('Errors 5')).toBeInTheDocument();
    const table = within(report).getByRole('table', { name: 'First errors' });
    expect(within(table).getByText('eight fifty')).toBeInTheDocument();
    expect(within(table).getByText('Same as row 98 in building A')).toBeInTheDocument();
    expect(within(report).getByRole('button', { name: 'Download error file' })).toBeInTheDocument();
    expect(within(report).getByText(/Showing the first 2 of 5 errors/)).toBeInTheDocument();
  });

  it('blocks "Import all" while errors exist and commits valid rows only', async () => {
    let phase: 'validated' | 'done' = 'validated';
    const api = renderIt({
      'POST /units/imports': ok({ importId: 4411, status: 'VALIDATING' }),
      'GET /units/imports/4411': () =>
        ok(
          phase === 'done'
            ? importReport({
                status: 'COMMITTED_PARTIAL',
                commitPolicy: 'VALID_ROWS_ONLY',
                result: { written: 304, skipped: 8, failureCode: null },
              })
            : importReport(),
        ),
      'POST /units/imports/4411/commit': () => {
        phase = 'done';
        return ok({ importId: 4411, status: 'COMMITTING' });
      },
    });
    const dlg = await chooseFile();
    const report = await within(dlg).findByRole('region', { name: 'Import report' });
    expect(within(report).getByRole('button', { name: 'Import all (needs zero errors)' })).toBeDisabled();
    await userEvent.click(within(report).getByRole('button', { name: 'Import valid rows only' }));
    expect(await within(dlg).findByText('304 flats written, 8 skipped.')).toBeInTheDocument();
    expect(api.last('POST', '/units/imports/4411/commit')!.body).toEqual({ commitPolicy: 'VALID_ROWS_ONLY' });
    expect(within(dlg).getByRole('link', { name: 'Go to flats' })).toHaveAttribute('href', '/admin/units');
    expect(onDone).toHaveBeenCalled();
  });

  it('commits all-or-nothing when there are no errors', async () => {
    let done = false;
    const clean = importReport({
      counts: { create: 10, update: 0, unchanged: 0, error: 0 },
      errorsPreview: [],
      reportFileId: null,
      totalRows: 10,
    });
    const api = renderIt({
      'POST /units/imports': ok({ importId: 4411, status: 'VALIDATING' }),
      'GET /units/imports/4411': () =>
        ok(
          done
            ? { ...clean, status: 'COMMITTED', result: { written: 10, skipped: 0, failureCode: null } }
            : clean,
        ),
      'POST /units/imports/4411/commit': () => {
        done = true;
        return ok({ importId: 4411, status: 'COMMITTING' });
      },
    });
    const dlg = await chooseFile();
    const all = await within(dlg).findByRole('button', { name: 'Import all (needs zero errors)' });
    expect(within(dlg).queryByRole('button', { name: 'Download error file' })).not.toBeInTheDocument();
    await userEvent.click(all);
    expect(await within(dlg).findByText('10 flats written, 0 skipped.')).toBeInTheDocument();
    expect(api.last('POST', '/units/imports/4411/commit')!.body).toEqual({ commitPolicy: 'ALL_OR_NOTHING' });
  });

  it('says there is nothing to write when no rows are new or changed', async () => {
    renderIt({
      'POST /units/imports': ok({ importId: 4411, status: 'VALIDATING' }),
      'GET /units/imports/4411': ok(
        importReport({ counts: { create: 0, update: 0, unchanged: 3, error: 0 }, errorsPreview: [] }),
      ),
    });
    const dlg = await chooseFile();
    expect(await within(dlg).findByText(/nothing to write/)).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Import valid rows only' })).toBeDisabled();
  });

  it('explains a failed import by its failure code', async () => {
    renderIt({
      'POST /units/imports': ok({ importId: 4411, status: 'VALIDATING' }),
      'GET /units/imports/4411': ok(
        importReport({ status: 'FAILED', result: { written: 0, skipped: 0, failureCode: 'IMPORT_STALE' } }),
      ),
    });
    const dlg = await chooseFile();
    expect(await within(dlg).findByText(/new errors appeared/)).toBeInTheDocument();
  });

  it.each([
    ['IMPORT_IN_PROGRESS', 409, /Another import is running/],
    ['IMPORT_FILE_NOT_READY', 409, /still being scanned/],
    ['FILE_NOT_FOUND', 404, /file was not found/],
    ['FILE_NOT_LINKABLE', 422, /cannot be used here/],
  ])('shows %s when starting', async (code, status, text) => {
    renderIt({ 'POST /units/imports': err(status, code) });
    const dlg = await chooseFile();
    expect(await within(dlg).findByText(text)).toBeInTheDocument();
  });

  it('shows IMPORT_NOT_FOUND when the import expired while polling', async () => {
    renderIt({
      'POST /units/imports': ok({ importId: 4411, status: 'VALIDATING' }),
      'GET /units/imports/4411': err(404, 'IMPORT_NOT_FOUND'),
    });
    const dlg = await chooseFile();
    expect(await within(dlg).findByText(/expired or does not exist/)).toBeInTheDocument();
  });

  it.each([
    ['IMPORT_HAS_ERRORS', 422, /Rows with errors exist/],
    ['IMPORT_NOTHING_TO_COMMIT', 422, /nothing to write/],
    ['INVALID_STATE', 409, /not allowed in the current state/],
  ])('shows %s from the commit', async (code, status, text) => {
    renderIt({
      'POST /units/imports': ok({ importId: 4411, status: 'VALIDATING' }),
      'GET /units/imports/4411': ok(importReport()),
      'POST /units/imports/4411/commit': err(status, code),
    });
    const dlg = await chooseFile();
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Import valid rows only' }));
    await waitFor(() => expect(within(dlg).getByText(text)).toBeInTheDocument());
  });
});
