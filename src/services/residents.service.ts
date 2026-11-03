/** Every module 09 network call (spec section 8). Screens import from here and never call `fetch` themselves. */
import { api, apiList } from '@/lib/apiClient';
import {
  normaliseEmergency,
  normaliseHousehold,
  normaliseJoinRequest,
  normalisePortfolio,
  normaliseTenancy,
  normaliseUnitPanel,
  type RawEmergency,
  type RawHouseholdUnit,
  type RawJoinRequest,
  type RawPanel,
  type RawTenancy,
} from './residentsMappers';
import type {
  CreatedResident,
  DirectoryEntry,
  DocType,
  EndLinkInput,
  FlatQuery,
  FlatRow,
  JoinInput,
  JoinRequest,
  JoinSociety,
  LinkInput,
  MemberInput,
  MoveInput,
  MoveQuery,
  MoveRequest,
  Paged,
  Permit,
  PermitInput,
  PoliceVerificationInput,
  PortfolioUnit,
  Pet,
  PetInput,
  Privacy,
  Resident,
  ResidentDetail,
  ResidentDocument,
  ResidentInput,
  ResidentQuery,
  Stats,
  Tenancy,
  TenancyInput,
  TenancyQuery,
  TimelineEvent,
  Transfer,
  TransferInput,
} from '@/types/residents';

type Query = Record<string, string | number | boolean | undefined>;

const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
const del = (path: string, body?: unknown) => api<void>(path, { method: 'DELETE', body });

/** Lists answer `data: []` with a top-level `pagination`. */
async function paged<T, R = T>(path: string, query: object = {}, map?: (raw: R) => T): Promise<Paged<T>> {
  const r = await apiList<R>(path, { query: query as Query });
  const rows = Array.isArray(r.data) ? r.data : [];
  return { items: map ? rows.map(map) : (rows as unknown as T[]), pagination: r.pagination ?? null };
}

/** Lists the screens read as plain arrays (`/me/*`); a non-array answer becomes an empty list. */
const arr =
  <T, R = T>(map?: (raw: R) => T) =>
  (raw: unknown): T[] =>
    Array.isArray(raw) ? (map ? (raw as R[]).map(map) : (raw as T[])) : [];

export const residentsService = {
  // admin: flats, stats, people
  stats: () => api<Stats>('/residents/stats'),
  flats: (q: FlatQuery = {}) => paged<FlatRow>('/residents/units', q),
  unit: (unitId: number, reveal = false) =>
    api<RawPanel>(`/residents/units/${unitId}`, { query: { reveal: reveal ? 'contacts' : undefined } }).then(
      normaliseUnitPanel,
    ),
  timeline: (unitId: number) => api<TimelineEvent[]>(`/residents/units/${unitId}/timeline`),
  vacate: (unitId: number, reason: string) =>
    post<{ occupancy: string; endedLinks: number; endedTenancyId: number | null }>(
      `/residents/units/${unitId}/vacate`,
      { reason },
    ),
  setShares: (
    unitId: number,
    body: {
      shares: { linkId: number; sharePercent: string }[];
      primaryLinkId: number;
      version: { linkId: number; version: number }[];
    },
  ) => put<unknown>(`/residents/units/${unitId}/ownership-shares`, body),

  residents: (q: ResidentQuery = {}) => paged<Resident>('/residents', q),
  resident: (id: number, reveal = false) =>
    api<ResidentDetail>(`/residents/${id}`, { query: { reveal: reveal ? 'contacts' : undefined } }),
  createResident: (body: ResidentInput) => post<CreatedResident>('/residents', body, true),
  updateResident: (id: number, body: Record<string, unknown>) =>
    patch<ResidentDetail>(`/residents/${id}`, body),
  deleteResident: (id: number, reason: string, version: number) =>
    del(`/residents/${id}`, { reason, version }),
  invite: (id: number, body: { email?: string; message?: string } = {}) =>
    post<{ mode: 'INVITED' | 'LINKED' }>(`/residents/${id}/invite`, body, true),
  addLink: (residentId: number, body: LinkInput) =>
    post<unknown>(`/residents/${residentId}/links`, body, true),
  updateLink: (linkId: number, body: Record<string, unknown>) =>
    patch<unknown>(`/residents/links/${linkId}`, body),
  endLink: (linkId: number, body: EndLinkInput) => post<unknown>(`/residents/links/${linkId}/end`, body),
  exportCsv: (q: ResidentQuery = {}) =>
    api<{ fileId: number; downloadUrl: string; expiresAt: string; rowCount: number }>('/residents/export', {
      query: q as Query,
    }),

  // documents
  addDocument: (
    residentId: number,
    body: { fileId: number; docType: DocType; title?: string; idLast4?: string },
  ) => post<ResidentDocument>(`/residents/${residentId}/documents`, body, true),
  verifyDocument: (
    docId: number,
    body: { decision: 'VERIFIED' | 'REJECTED'; reason?: string; version: number },
  ) => post<unknown>(`/resident-documents/${docId}/verify`, body),
  deleteDocument: (docId: number, reason: string) => del(`/resident-documents/${docId}`, { reason }),
  documentUrl: (docId: number) =>
    api<{ url: string; expiresAt: string }>(`/resident-documents/${docId}/download-url`, {
      query: { disposition: 'attachment' },
    }),

  // tenancies
  tenancies: (q: TenancyQuery = {}) => paged<Tenancy, RawTenancy>('/tenancies', q, normaliseTenancy),
  tenancy: (id: number) => api<RawTenancy>(`/tenancies/${id}`).then(normaliseTenancy),
  createTenancy: (body: TenancyInput) => post<RawTenancy>('/tenancies', body, true).then(normaliseTenancy),
  tenancyAction: (
    id: number,
    action: 'submit' | 'approve' | 'reject' | 'activate' | 'renew' | 'end' | 'cancel',
    body: object,
  ) => post<RawTenancy>(`/tenancies/${id}/${action}`, body).then(normaliseTenancy),
  policeVerification: (id: number, body: PoliceVerificationInput) =>
    patch<RawTenancy>(`/tenancies/${id}/police-verification`, body).then(normaliseTenancy),

  // join requests (admin)
  joinRequests: (q: { status?: string; page?: number; limit?: number } = {}) =>
    paged<JoinRequest, RawJoinRequest>('/join-requests', q, normaliseJoinRequest),
  joinRequest: (id: number) => api<RawJoinRequest>(`/join-requests/${id}`).then(normaliseJoinRequest),
  /** Module 14 inbox actions for the card's `approvalRequestId`. */
  approvalApprove: (approvalRequestId: number) =>
    post<unknown>(`/approvals/${approvalRequestId}/approve`, {}),
  approvalReject: (approvalRequestId: number, reason: string) =>
    post<unknown>(`/approvals/${approvalRequestId}/reject`, { reason }),

  // moves
  moves: (q: MoveQuery = {}) => paged<MoveRequest>('/move-requests', q),
  createMove: (body: MoveInput) => post<MoveRequest>('/move-requests', body, true),
  moveAction: (
    id: number,
    action: 'recheck-dues' | 'override-dues' | 'start' | 'complete' | 'inspection' | 'cancel',
    body: object,
  ) => post<MoveRequest>(`/move-requests/${id}/${action}`, body, action === 'inspection'),

  // renovation permits
  permits: (q: { status?: string; unitId?: number; page?: number; limit?: number } = {}) =>
    paged<Permit>('/renovation-permits', q),
  createPermit: (body: PermitInput) => post<Permit>('/renovation-permits', body, true),
  permitAction: (
    id: number,
    action: 'start' | 'extend' | 'violations' | 'suspend' | 'resume' | 'work-done' | 'inspect' | 'cancel',
    body: object,
  ) =>
    post<Permit>(
      `/renovation-permits/${id}/${action}`,
      body,
      action === 'violations' || action === 'inspect',
    ),

  // ownership transfers
  transfers: (q: { status?: string; unitId?: number; page?: number; limit?: number } = {}) =>
    paged<Transfer>('/ownership-transfers', q),
  transfer: (id: number) => api<Transfer>(`/ownership-transfers/${id}`),
  createTransfer: (body: TransferInput) => post<Transfer>('/ownership-transfers', body, true),
  transferAction: (id: number, action: 'submit' | 'complete' | 'cancel', body: object) =>
    post<Transfer>(`/ownership-transfers/${id}/${action}`, body, action === 'complete'),

  // pets register
  pets: (q: { unitId?: number; species?: string; vaccination?: string } = {}) => paged<Pet>('/pets', q),

  // resident app: join
  joinSociety: (code: string) => api<JoinSociety>(`/me/join/societies/${encodeURIComponent(code)}`),
  joinUnits: (code: string, q: string) =>
    api<{ unitId: number; label: string }[]>(`/me/join/societies/${encodeURIComponent(code)}/units`, {
      query: { q },
    }),
  submitJoin: (body: JoinInput) => post<JoinRequest>('/me/join-requests', body, true),
  myJoinRequests: () =>
    api<unknown>('/me/join-requests').then(arr<JoinRequest, RawJoinRequest>(normaliseJoinRequest)),
  withdrawJoin: (id: number, version: number) =>
    post<{ id: number; status: string; version: number }>(`/me/join-requests/${id}/withdraw`, { version }),

  // resident app: household
  household: () => api<{ units?: RawHouseholdUnit[] }>('/me/household').then(normaliseHousehold),
  portfolio: () =>
    api<{ units?: PortfolioUnit[] } | PortfolioUnit[]>('/me/portfolio').then(normalisePortfolio),
  addMember: (body: MemberInput) => post<unknown>('/me/household/members', body, true),
  removeMember: (linkId: number, reason?: string) =>
    del(`/me/household/members/${linkId}`, reason ? { reason } : undefined),
  inviteMember: (linkId: number) => post<unknown>(`/me/household/members/${linkId}/invite`, {}, true),
  confirmations: () =>
    api<unknown>('/me/household/join-requests').then(arr<JoinRequest, RawJoinRequest>(normaliseJoinRequest)),
  confirmJoin: (id: number, version: number, note?: string) =>
    post<unknown>(`/me/household/join-requests/${id}/confirm`, { version, ...(note ? { note } : {}) }),
  declineJoin: (id: number, version: number, reason: string) =>
    post<unknown>(`/me/household/join-requests/${id}/decline`, { version, reason }),

  // resident app: tenants
  myTenancies: () => api<unknown>('/me/tenancies').then(arr<Tenancy, RawTenancy>(normaliseTenancy)),
  addTenancy: (body: TenancyInput) => post<RawTenancy>('/me/tenancies', body, true).then(normaliseTenancy),
  submitTenancy: (id: number, version: number) =>
    post<RawTenancy>(`/me/tenancies/${id}/submit`, { version }).then(normaliseTenancy),
  /** The backend takes a `fileIds` list, even for one file. */
  addTenancyDocument: (id: number, body: { fileId: number; docType: DocType; title?: string }) =>
    post<unknown>(`/me/tenancies/${id}/documents`, { fileIds: [body] }, true),

  // resident app: requests
  myMoves: () => api<MoveRequest[]>('/me/move-requests'),
  requestMove: (body: MoveInput) => post<MoveRequest>('/me/move-requests', body, true),
  myMoveAction: (
    id: number,
    action: 'recheck-dues' | 'owner-confirm' | 'owner-decline' | 'cancel',
    body: object,
  ) => post<MoveRequest>(`/me/move-requests/${id}/${action}`, body),
  myPermits: () => api<Permit[]>('/me/renovation-permits'),
  requestPermit: (body: PermitInput) => post<Permit>('/me/renovation-permits', body, true),
  myPermitAction: (id: number, action: 'work-done' | 'cancel', body: object) =>
    post<Permit>(`/me/renovation-permits/${id}/${action}`, body),
  myTransfers: () => api<Transfer[]>('/me/ownership-transfers'),
  requestTransfer: (body: TransferInput) => post<Transfer>('/me/ownership-transfers', body, true),
  myTransferAction: (id: number, action: 'submit' | 'cancel', body: object) =>
    post<Transfer>(`/me/ownership-transfers/${id}/${action}`, body),

  // resident app: me
  myPets: () => api<Pet[]>('/me/pets'),
  addPet: (body: PetInput) => post<Pet>('/me/pets', body, true),
  updatePet: (id: number, body: PetInput) => patch<Pet>(`/me/pets/${id}`, body),
  deletePet: (id: number) => del(`/me/pets/${id}`),
  emergency: () => api<RawEmergency>('/me/emergency-profile').then(normaliseEmergency),
  saveEmergency: (body: Record<string, unknown>) =>
    put<RawEmergency>('/me/emergency-profile', body).then(normaliseEmergency),
  privacy: () => api<Privacy>('/me/privacy'),
  savePrivacy: (body: Partial<Privacy> & { version: number }) => patch<Privacy>('/me/privacy', body),
  directory: (q: { q?: string; page?: number; limit?: number } = {}) =>
    paged<DirectoryEntry>('/me/directory', q),
  myDocuments: () => api<ResidentDocument[]>('/me/documents'),
  uploadMyDocument: (body: { fileId: number; docType: DocType; title?: string; idLast4?: string }) =>
    post<ResidentDocument>('/me/documents', body, true),
  myDocumentUrl: (docId: number) =>
    api<{ url: string; expiresAt: string }>(`/me/documents/${docId}/download-url`, {
      query: { disposition: 'attachment' },
    }),
};
