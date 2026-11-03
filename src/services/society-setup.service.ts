/** Every module 08 network call (spec section 8). Screens import from here and never call `fetch` themselves. */
import { api, apiList, type Pagination } from '@/lib/apiClient';
import type {
  Building,
  BuildingGrid,
  BuildingInput,
  BuildingQuery,
  BulkUpdateInput,
  CommitPolicy,
  Holiday,
  HolidayInput,
  HolidaySuggestion,
  GeneratorInput,
  GeneratorPreview,
  GeneratorResult,
  ImportMode,
  ImportReport,
  LocationInput,
  LocationNode,
  Onboarding,
  SettingChange,
  SettingItem,
  SocietyProfile,
  SocietyProfileInput,
  StepKey,
  Unit,
  UnitInput,
  UnitQuery,
} from '@/types/societySetup';

type Query = Record<string, string | number | boolean | undefined>;

export interface Paged<T> {
  items: T[];
  pagination: Pagination | null;
}

const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
const del = (path: string) => api<void>(path, { method: 'DELETE' });

const items = <T>(d: unknown): T[] => (Array.isArray(d) ? d : ((d as { items?: T[] } | null)?.items ?? []));

async function paged<T>(path: string, query: object): Promise<Paged<T>> {
  const r = await apiList<T>(path, { query: query as Query });
  return { items: items<T>(r.data), pagination: r.pagination ?? null };
}

export const societySetupService = {
  // profile and settings
  society: () => api<SocietyProfile>('/society'),
  updateSociety: (body: SocietyProfileInput) => patch<SocietyProfile>('/society', body),
  settings: async (namespace?: string) =>
    items<SettingItem>(await api<unknown>('/society/settings', { query: { namespace } })),
  saveSettings: async (changes: SettingChange[], reason?: string) =>
    items<SettingItem>(await patch<unknown>('/society/settings', { changes, ...(reason ? { reason } : {}) })),

  // buildings
  buildings: (q: BuildingQuery = {}) => paged<Building>('/buildings', q),
  createBuilding: (body: BuildingInput) => post<Building>('/buildings', body, true),
  updateBuilding: (id: number, body: BuildingInput) => patch<Building>(`/buildings/${id}`, body),
  archiveBuilding: (id: number, reason: string, version: number) =>
    post<Building>(`/buildings/${id}/archive`, { reason, version }),
  restoreBuilding: (id: number, version: number) => post<Building>(`/buildings/${id}/restore`, { version }),
  deleteBuilding: (id: number) => del(`/buildings/${id}`),
  grid: (id: number, includeArchived = false) =>
    api<BuildingGrid>(`/buildings/${id}/grid`, { query: { includeArchived } }),

  // units
  units: (q: UnitQuery = {}) => paged<Unit>('/units', q),
  unit: (id: number) => api<Unit>(`/units/${id}`),
  createUnit: (body: UnitInput) => post<Unit>('/units', body, true),
  updateUnit: (id: number, body: UnitInput) => patch<Unit>(`/units/${id}`, body),
  archiveUnit: (id: number, reason: string, version: number) =>
    post<Unit>(`/units/${id}/archive`, { reason, version }),
  restoreUnit: (id: number, version: number) => post<Unit>(`/units/${id}/restore`, { version }),
  deleteUnit: (id: number) => del(`/units/${id}`),
  bulkUpdate: (body: BulkUpdateInput) =>
    post<{ updated: number; unitIds: number[] }>('/units/bulk-update', body),
  previewGenerator: (body: GeneratorInput) => post<GeneratorPreview>('/units/generator/preview', body),
  commitGenerator: (body: GeneratorInput & { previewHash: string }) =>
    post<GeneratorResult>('/units/generator/commit', body, true),
  startImport: (fileId: number, mode: ImportMode, createMissingBuildings: boolean) =>
    post<{ importId: number; status: string }>(
      '/units/imports',
      { fileId, mode, createMissingBuildings },
      true,
    ),
  importStatus: (importId: number, opts: { activity?: boolean } = {}) =>
    api<ImportReport>(`/units/imports/${importId}`, opts),
  commitImport: (importId: number, commitPolicy: CommitPolicy) =>
    post<{ importId: number; status: string }>(`/units/imports/${importId}/commit`, { commitPolicy }, true),
  exportUnits: (body: { status?: 'ACTIVE' | 'ALL'; buildingId?: number } = {}) =>
    post<{ queued: boolean }>('/units/export', body, true),
  /** Module 01 file download (`GET /files/:id/download-url`), used for the import error report. */
  fileDownloadUrl: (fileId: number) => api<{ url: string }>(`/files/${fileId}/download-url`),

  // locations
  locations: async (q: { status?: 'ACTIVE' | 'ALL'; buildingId?: number } = {}) =>
    items<LocationNode>(await api<unknown>('/locations', { query: q })),
  createLocation: (body: LocationInput) => post<LocationNode>('/locations', body, true),
  updateLocation: (id: number, body: LocationInput) => patch<LocationNode>(`/locations/${id}`, body),
  archiveLocation: (id: number, version: number) =>
    post<LocationNode>(`/locations/${id}/archive`, { version }),
  restoreLocation: (id: number, version: number) =>
    post<LocationNode>(`/locations/${id}/restore`, { version }),
  regenerateQr: (id: number, version: number) =>
    post<LocationNode>(`/locations/${id}/regenerate-qr`, { version }),

  // holidays
  holidays: (year: number) =>
    api<{ items: Holiday[]; weeklyOffDays: number[] }>('/holidays', { query: { year } }),
  // The API names the date `date`; the screens use `holidayDate` like the create form.
  holidaySuggestions: async (year: number) =>
    items<HolidaySuggestion & { date?: string }>(
      await api<unknown>('/holidays/suggestions', { query: { year } }),
    ).map(s => ({ ...s, holidayDate: s.holidayDate ?? s.date ?? '' })),
  createHoliday: (body: HolidayInput) => post<Holiday>('/holidays', body, true),
  bulkHolidays: (list: HolidayInput[]) =>
    post<{ created: number; skipped: string[] }>('/holidays/bulk', { items: list }, true),
  updateHoliday: (id: number, body: HolidayInput) => patch<Holiday>(`/holidays/${id}`, body),
  deleteHoliday: (id: number) => del(`/holidays/${id}`),

  // onboarding
  onboarding: () => api<Onboarding>('/onboarding'),
  completeStep: (key: StepKey) => post<Onboarding>(`/onboarding/steps/${key}/complete`, {}),
  skipStep: (key: StepKey, reason: string) => post<Onboarding>(`/onboarding/steps/${key}/skip`, { reason }),
  reopenStep: (key: StepKey) => post<Onboarding>(`/onboarding/steps/${key}/reopen`, {}),
  goLive: () => post<Onboarding>('/onboarding/go-live', {}, true),
};
