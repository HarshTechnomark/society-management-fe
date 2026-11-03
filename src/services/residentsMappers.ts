/**
 * Normalisers from the module 09 backend response shapes to the shapes the screens use (types/residents.ts).
 * Each one takes the real backend DTO (see the `Raw*` types) and never throws on a missing optional field.
 */
import type {
  EmergencyProfile,
  FamilyRelation,
  Household,
  HouseholdOf,
  HouseholdPerson,
  HouseholdUnit,
  JoinRequest,
  OpenRequest,
  Occupancy,
  PortfolioUnit,
  Tenancy,
  UnitOwner,
  UnitPanel,
} from '@/types/residents';

/** The flat person the unit panel puts on `owners[]`, `household[]` and `tenancy.tenant` (spec 8.3). */
export interface RawPerson {
  residentId: number;
  name: string;
  mobile: string | null;
  hasLogin: boolean;
  isMinor: boolean;
}

export interface RawPanel {
  unit: {
    id: number;
    label: string;
    unitType: string;
    areaSqft: number | null;
    buildingId: number;
    buildingCode?: string | null;
    status?: string;
  };
  occupancy: Occupancy;
  owners: (RawPerson & {
    linkId: number;
    relation: string;
    sharePercent: string | null;
    isPrimary: boolean;
    isResiding: boolean;
    from: string;
    version: number;
  })[];
  tenancy: {
    id: number;
    status: Tenancy['status'];
    agreementStart: string;
    agreementEnd: string;
    maintenancePayer: 'OWNER' | 'TENANT';
    policeVerificationStatus: Tenancy['policeVerificationStatus'];
    tenant: RawPerson;
  } | null;
  household: (RawPerson & {
    linkId: number;
    relation: 'FAMILY' | 'CARETAKER';
    familyRelation: FamilyRelation | null;
    householdOf: HouseholdOf;
    canLogin: boolean;
    isResiding: boolean;
    from: string;
    version: number;
  })[];
  pets?: { id: number; name: string; species: string }[];
  openRequests: OpenRequest[];
  duesPaise: number;
  billTo: { residentId?: number; name: string; relation: string; tenancyId?: number | null } | null;
}

const person = (p: RawPerson) => ({ id: p.residentId, name: p.name, mobile: p.mobile });

export function normaliseUnitPanel(raw: RawPanel): UnitPanel {
  return {
    unit: {
      id: raw.unit.id,
      label: raw.unit.label,
      type: raw.unit.unitType,
      areaSqft: raw.unit.areaSqft,
      ...(raw.unit.buildingCode ? { building: raw.unit.buildingCode } : {}),
    },
    occupancy: raw.occupancy,
    owners: (raw.owners ?? []).map((o): UnitOwner => ({
      linkId: o.linkId,
      version: o.version,
      resident: person(o),
      sharePercent: o.sharePercent,
      isPrimary: o.isPrimary,
      isResiding: o.isResiding,
      fromDate: o.from,
    })),
    tenancy: raw.tenancy
      ? {
          id: raw.tenancy.id,
          status: raw.tenancy.status,
          agreementStart: raw.tenancy.agreementStart,
          agreementEnd: raw.tenancy.agreementEnd,
          maintenancePayer: raw.tenancy.maintenancePayer,
          policeVerificationStatus: raw.tenancy.policeVerificationStatus,
          ...(raw.tenancy.tenant
            ? {
                tenant: {
                  residentId: raw.tenancy.tenant.residentId,
                  name: raw.tenancy.tenant.name,
                  mobile: raw.tenancy.tenant.mobile,
                },
              }
            : {}),
        }
      : null,
    household: (raw.household ?? []).map(h => ({
      linkId: h.linkId,
      resident: person(h),
      relation: h.relation,
      familyRelation: h.familyRelation,
      householdOf: h.householdOf,
    })),
    openRequests: raw.openRequests ?? [],
    duesPaise: raw.duesPaise ?? 0,
    billTo: raw.billTo ? { name: raw.billTo.name, relation: raw.billTo.relation } : null,
  };
}

/** Tenancy: the backend names the police reference `policeVerificationRef` and the reject reason `decisionReason`. */
export type RawTenancy = Omit<Tenancy, 'policeVerificationReference' | 'rejectReason'> & {
  policeVerificationRef?: string | null;
  decisionReason?: string | null;
};

export function normaliseTenancy(raw: RawTenancy): Tenancy {
  const { policeVerificationRef, decisionReason, ...rest } = raw;
  return {
    ...rest,
    policeVerificationReference: policeVerificationRef ?? null,
    rejectReason: rest.status === 'REJECTED' || rest.status === 'CANCELLED' ? (decisionReason ?? null) : null,
  };
}

/** Join request: `documentsReceived` is a count; the reject reason is `decisionReason` (the owner's note when declined). */
export type RawJoinRequest = Omit<JoinRequest, 'documentsReceived' | 'rejectReason'> & {
  documentsReceived?: number | boolean;
  decisionReason?: string | null;
  ownerDecisionNote?: string | null;
};

export function normaliseJoinRequest(raw: RawJoinRequest): JoinRequest {
  const { documentsReceived, decisionReason, ownerDecisionNote, ...rest } = raw;
  return {
    ...rest,
    documentsReceived:
      typeof documentsReceived === 'number' ? documentsReceived > 0 : Boolean(documentsReceived),
    rejectReason: rest.status === 'REJECTED' ? (decisionReason ?? ownerDecisionNote ?? null) : null,
  };
}

/** `/me/household`: the unit tenancy carries no tenant, so the tenant person of the list fills it in. */
export interface RawHouseholdUnit extends Omit<HouseholdUnit, 'tenancy' | 'people'> {
  people: (HouseholdPerson & { isResiding?: boolean; version?: number })[];
  tenancy: {
    id: number;
    status: Tenancy['status'];
    agreementEnd: string;
    policeVerificationStatus: Tenancy['policeVerificationStatus'];
  } | null;
}

export function normaliseHousehold(raw: { units?: RawHouseholdUnit[] } | null): Household {
  return {
    units: (raw?.units ?? []).map(u => {
      const tenant = u.people.find(p => p.relation === 'TENANT');
      return {
        ...u,
        tenancy: u.tenancy
          ? ({
              ...u.tenancy,
              unit: { id: u.unitId, label: u.unitLabel },
              tenant: {
                residentId: tenant?.residentId ?? 0,
                name: tenant?.name ?? '',
                mobile: tenant?.mobile ?? null,
              },
              agreementStart: '',
              maintenancePayer: 'OWNER',
              monthlyRentPaise: null,
              landlord: null,
              version: 0,
            } as Tenancy)
          : null,
      };
    }),
  };
}

/** `/me/portfolio` answers `{ units: [...] }`. */
export function normalisePortfolio(
  raw: { units?: PortfolioUnit[] } | PortfolioUnit[] | null,
): PortfolioUnit[] {
  if (Array.isArray(raw)) return raw;
  return raw?.units ?? [];
}

/** Emergency profile: the backend sends `consent` as `{ given, givenAt, ... }`; the screen wants a flag. */
export interface RawEmergency extends Omit<EmergencyProfile, 'consent'> {
  consent?: { given: boolean; givenAt?: string | null } | boolean;
}

export function normaliseEmergency(raw: RawEmergency): EmergencyProfile {
  const c = raw.consent;
  return { ...raw, consent: typeof c === 'object' && c !== null ? c.given : Boolean(c) };
}
