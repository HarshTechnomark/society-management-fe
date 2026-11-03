/** Module 09 response and request shapes (spec section 8). Fields the spec does not list are optional. */

export type Relation = 'OWNER' | 'CO_OWNER' | 'TENANT' | 'FAMILY' | 'CARETAKER';
export type FamilyRelation =
  'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'GRANDPARENT' | 'GRANDCHILD' | 'RELATIVE' | 'OTHER';
export type HouseholdOf = 'OWNER' | 'TENANT';
export type Occupancy = 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT';
export type KycStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type DocType =
  | 'AADHAAR'
  | 'PAN'
  | 'PASSPORT'
  | 'DRIVING_LICENCE'
  | 'VOTER_ID'
  | 'OTHER_ID'
  | 'ADDRESS_PROOF'
  | 'RENT_AGREEMENT'
  | 'POLICE_VERIFICATION'
  | 'SALE_DEED'
  | 'INDEX_II'
  | 'STAMP_DUTY_RECEIPT'
  | 'ORIGINAL_SHARE_CERTIFICATE'
  | 'MEMBERSHIP_APPLICATION'
  | 'NOC'
  | 'DEATH_CERTIFICATE'
  | 'SUCCESSION_CERTIFICATE'
  | 'CONTRACTOR_ID'
  | 'WORK_PLAN'
  | 'STRUCTURAL_CERTIFICATE'
  | 'VACCINATION_CERTIFICATE'
  | 'OTHER';

export interface FileRef {
  fileId: number;
  docType: DocType;
  idLast4?: string;
  expiresOn?: string;
  title?: string;
}

export interface Paged<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number } | null;
}

/* residents */
export interface ResidentLink {
  linkId: number;
  unitId: number;
  unitLabel: string;
  relation: Relation;
  familyRelation?: FamilyRelation | null;
  sharePercent: string | null;
  isPrimary: boolean;
  isResiding: boolean;
  canLogin?: boolean;
  fromDate: string;
  toDate: string | null;
  version?: number;
}

export interface Resident {
  id: number;
  name: string;
  mobile: string | null;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  hasLogin: boolean;
  isMinor: boolean;
  photoFileId: number | null;
  links: ResidentLink[];
  kycStatus: KycStatus;
}

export interface ResidentDocument {
  id: number;
  docType: DocType;
  title: string | null;
  idLast4: string | null;
  expiresOn: string | null;
  verificationStatus: VerificationStatus;
  uploadedAt: string;
  version?: number;
}

export interface ResidentDetail extends Resident {
  alternateMobile?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  preferredLanguage?: string | null;
  isNri?: boolean;
  overseasPhone?: string | null;
  adminNote?: string | null;
  userStatus?: string | null;
  memberId?: number | null;
  documents: ResidentDocument[];
  emergencyProfile: { exists: boolean; hasCareFlags: boolean };
  openRequests?: OpenRequest[];
  version: number;
}

export interface ResidentQuery {
  q?: string;
  relation?: Relation;
  status?: 'ACTIVE' | 'INACTIVE';
  hasLogin?: boolean;
  kycStatus?: KycStatus;
  unitId?: number;
  page?: number;
  limit?: number;
}

export interface LinkInput {
  unitId: number;
  relation: Relation;
  familyRelation?: FamilyRelation;
  householdOf?: HouseholdOf;
  sharePercent?: string;
  isPrimary?: boolean;
  isResiding?: boolean;
  canLogin?: boolean;
  fromDate: string;
}

export interface ResidentInput {
  name: string;
  mobile?: string;
  email?: string;
  dateOfBirth?: string;
  link?: LinkInput;
  invite?: boolean;
}

export interface CreatedResident {
  id: number;
  name: string;
  mobile: string | null;
  status: string;
  version: number;
  links: ResidentLink[];
  invitation?: { id: number; status: string; expiresAt: string } | null;
  warnings: string[];
}

export interface EndLinkInput {
  toDate: string;
  endReason: 'MOVED_OUT' | 'SOLD' | 'TRANSFERRED' | 'DECEASED' | 'CORRECTION' | 'REMOVED' | 'OTHER';
  endNote?: string;
  promoteLinkId?: number;
  version: number;
}

/* flats */
export interface FlatRow {
  unitId: number;
  unitLabel: string;
  buildingId: number;
  unitType: string;
  areaSqft: number | null;
  bhk?: string | number | null;
  occupancy: Occupancy;
  primaryOwner: { residentId: number; name: string; mobile: string | null } | null;
  tenant: {
    residentId: number;
    name: string;
    mobile: string | null;
    tenancyId: number;
    agreementEnd: string;
  } | null;
  residentCount: number;
  duesPaise: number;
}

export interface FlatQuery {
  q?: string;
  buildingId?: number;
  occupancy?: Occupancy;
  hasDues?: boolean;
  page?: number;
  limit?: number;
}

export interface OpenRequest {
  kind: 'MOVE_IN' | 'MOVE_OUT' | 'RENOVATION' | 'TRANSFER' | 'JOIN';
  id: number;
  status: string;
}

export interface UnitOwner {
  linkId: number;
  version?: number;
  resident: { id: number; name: string; mobile?: string | null };
  sharePercent: string | null;
  isPrimary: boolean;
  isResiding: boolean;
  fromDate: string;
}

export interface UnitPanel {
  unit: {
    id: number;
    label: string;
    type: string;
    areaSqft: number | null;
    bhk?: string | number | null;
    building?: string;
  };
  occupancy: Occupancy;
  owners: UnitOwner[];
  tenancy: {
    id: number;
    status: TenancyStatus;
    agreementStart: string;
    agreementEnd: string;
    maintenancePayer: 'OWNER' | 'TENANT';
    policeVerificationStatus: PoliceStatus;
    tenant?: { residentId: number; name: string; mobile?: string | null };
  } | null;
  household: {
    linkId: number;
    resident: { id: number; name: string; mobile?: string | null };
    relation: 'FAMILY' | 'CARETAKER';
    familyRelation?: FamilyRelation | null;
    householdOf: HouseholdOf;
  }[];
  pets?: Pet[];
  openRequests: OpenRequest[];
  duesPaise: number;
  billTo?: { name: string; relation: string } | null;
}

export interface TimelineEvent {
  at: string;
  kind: string;
  label: string;
  refType?: string;
  refId?: number;
}

export interface Stats {
  units: number;
  ownerOccupied: number;
  rented: number;
  vacant: number;
  tenanciesExpiringIn30: number;
  tenanciesExpiringIn60: number;
  tenanciesExpiringIn90: number;
  overstaying: number;
  policeVerification: { active: number; verified: number; pending: number };
  openRequests: { join: number; moveIn: number; moveOut: number; renovation: number; transfer: number };
  residentsWithLogin: number;
  residents: number;
  petsVaccinationExpired: number;
}

/* tenancies */
export type TenancyStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'EXPIRED_OVERSTAY'
  | 'ENDED'
  | 'REJECTED'
  | 'CANCELLED';
export type PoliceStatus = 'NOT_REQUIRED' | 'NOT_SUBMITTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';

export interface Tenancy {
  id: number;
  status: TenancyStatus;
  unit: { id: number; label: string };
  tenant: { residentId: number; name: string; mobile: string | null };
  landlord: { residentId: number; name: string } | null;
  agreementType?: 'LEAVE_AND_LICENCE' | 'LEASE' | 'OTHER';
  agreementStart: string;
  agreementEnd: string;
  agreementRegistrationNo?: string | null;
  maintenancePayer: 'OWNER' | 'TENANT';
  monthlyRentPaise: number | null;
  securityDepositPaise?: number | null;
  occupantCount?: number | null;
  policeVerificationStatus: PoliceStatus;
  policeVerifiedOn?: string | null;
  policeVerificationReference?: string | null;
  endedOn?: string | null;
  endReason?: string | null;
  rejectReason?: string | null;
  documents?: ResidentDocument[];
  version: number;
}

export interface TenancyQuery {
  unitId?: number;
  status?: TenancyStatus;
  policeVerificationStatus?: PoliceStatus;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
}

export interface TenancyInput {
  unitId: number;
  tenant: { residentId: number } | { name: string; mobile: string; email?: string; dateOfBirth?: string };
  household?: { name: string; familyRelation?: FamilyRelation; relation?: 'CARETAKER'; mobile?: string }[];
  agreementType?: 'LEAVE_AND_LICENCE' | 'LEASE' | 'OTHER';
  agreementStart: string;
  agreementEnd: string;
  agreementRegistrationNo?: string;
  monthlyRentPaise?: number;
  securityDepositPaise?: number;
  maintenancePayer?: 'OWNER' | 'TENANT';
  occupantCount?: number;
  inviteTenant?: boolean;
  fileIds?: FileRef[];
}

export interface PoliceVerificationInput {
  status: PoliceStatus;
  verifiedOn?: string;
  reference?: string;
  note?: string;
  fileId?: number;
  version: number;
}

/* join requests */
export type JoinStatus =
  'PENDING_OWNER' | 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';

export interface JoinRequest {
  id: number;
  name?: string;
  requesterName?: string;
  mobile?: string | null;
  relation: Relation;
  unitLabel: string;
  societyName?: string;
  status: JoinStatus;
  createdAt?: string;
  expiresAt?: string;
  documentsReceived?: boolean;
  documents?: { id: number; docType: DocType; title?: string | null }[];
  approvalRequestId?: number | null;
  rejectReason?: string | null;
  version?: number;
}

export interface JoinSociety {
  societyId: number;
  name: string;
  city: string;
  joinable: boolean;
}

export interface JoinInput {
  societyCode: string;
  unitId: number;
  relation: Relation;
  familyRelation?: FamilyRelation;
  householdOf?: HouseholdOf;
  agreementStart?: string;
  agreementEnd?: string;
  email?: string;
  dateOfBirth?: string;
  message?: string;
  fileIds: FileRef[];
}

/* moves */
export type MoveStatus =
  | 'PENDING_OWNER'
  | 'BLOCKED_DUES'
  | 'PENDING_DEPOSIT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface MoveRequest {
  id: number;
  type: 'MOVE_IN' | 'MOVE_OUT';
  status: MoveStatus;
  unitId?: number;
  unitLabel: string;
  householdOf?: HouseholdOf;
  moveDate: string;
  slotStart: string;
  slotEnd: string;
  liftLabel?: string | null;
  vehicleNumber?: string | null;
  moverCompany?: string | null;
  moverMobile?: string | null;
  helperCount?: number | null;
  itemsNote?: string | null;
  duesBalancePaise: number;
  depositPaise: number;
  gatePassCode: string | null;
  inspectionStatus?: 'NOT_REQUIRED' | 'PENDING' | 'PASSED' | 'DAMAGE_FOUND';
  approvalRequestId?: number | null;
  next?: { action: string; payUrl?: string } | null;
  version: number;
}

export interface MoveQuery {
  type?: 'MOVE_IN' | 'MOVE_OUT';
  status?: MoveStatus;
  unitId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface MoveInput {
  unitId: number;
  type: 'MOVE_IN' | 'MOVE_OUT';
  householdOf: HouseholdOf;
  moveDate: string;
  slotStart: string;
  slotEnd: string;
  liftLabel?: string;
  vehicleNumber?: string;
  moverCompany?: string;
  moverMobile?: string;
  helperCount?: number;
  itemsNote?: string;
}

/* renovation */
export type PermitStatus =
  | 'PENDING_DEPOSIT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'SUSPENDED'
  | 'INSPECTION_PENDING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type WorkCategory =
  | 'INTERIOR'
  | 'CIVIL'
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'CARPENTRY'
  | 'PAINTING'
  | 'FLOORING'
  | 'WATERPROOFING'
  | 'KITCHEN'
  | 'BATHROOM'
  | 'OTHER';

export interface Permit {
  id: number;
  unitLabel: string;
  status: PermitStatus;
  workCategory: WorkCategory;
  workDescription?: string;
  contractorName?: string;
  contractorCompany?: string | null;
  contractorMobile?: string | null;
  workerCount?: number;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  depositPaise: number;
  feePaise: number;
  depositPayment?: { depositId: number; paymentOrderId: number } | null;
  conditions?: string | null;
  extensionCount?: number;
  approvalRequestId?: number | null;
  version: number;
}

export interface PermitInput {
  unitId: number;
  workCategory: WorkCategory;
  workDescription: string;
  involvesStructuralChange?: boolean;
  contractorName: string;
  contractorCompany?: string;
  contractorMobile: string;
  workerCount: number;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  fileIds: FileRef[];
}

export type ViolationCategory =
  'OUTSIDE_HOURS' | 'NOISE' | 'DEBRIS' | 'COMMON_AREA_DAMAGE' | 'UNAUTHORISED_WORK' | 'SAFETY' | 'OTHER';

/* transfers */
export type TransferType =
  'SALE' | 'GIFT' | 'INHERITANCE' | 'NOMINATION' | 'COURT_ORDER' | 'FAMILY_SETTLEMENT';
export type TransferStatus =
  'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export interface Transfer {
  id: number;
  status: TransferStatus;
  unitLabel: string;
  transferType: TransferType;
  effectiveDate: string;
  buyers: {
    residentId?: number;
    name: string;
    sharePercent: string;
    isPrimary: boolean;
    isResiding: boolean;
  }[];
  sellers?: { linkId?: number; name: string; sharePercent?: string | null }[];
  fees: {
    transferPremiumPaise: number;
    shareTransferFeePaise: number;
    entranceFeePaise: number;
    newBuyerCount: number;
    totalFeesPaise: number;
  };
  duesPolicy: 'MUST_CLEAR' | 'CARRY_WITH_UNIT';
  balancePaise?: number;
  missingDocuments: string[];
  feeInvoices?: { id: number; label?: string; status?: string; amountPaise?: number }[];
  approvalRequestId?: number | null;
  version: number;
}

export interface TransferInput {
  unitId: number;
  transferType: TransferType;
  effectiveDate: string;
  deedRegistrationNo?: string;
  deedDate?: string;
  considerationPaise?: number;
  buyers: { name: string; mobile: string; sharePercent: string; isPrimary: boolean; isResiding: boolean }[];
  duesPolicy?: 'MUST_CLEAR' | 'CARRY_WITH_UNIT';
  endTenancy?: boolean;
  notes?: string;
  fileIds?: FileRef[];
}

/* resident app */
export interface HouseholdPerson {
  linkId: number;
  residentId: number;
  name: string;
  relation: Relation;
  familyRelation?: FamilyRelation | null;
  isPrimary?: boolean;
  isMinor?: boolean;
  canLogin?: boolean;
  hasLogin: boolean;
  memberId?: number | null;
  mobile: string | null;
}
export interface HouseholdUnit {
  unitId: number;
  unitLabel: string;
  myRelation: Relation;
  occupancy: Occupancy;
  canManage: boolean;
  people: HouseholdPerson[];
  tenancy: Tenancy | null;
}
export interface Household {
  units: HouseholdUnit[];
}
export interface PortfolioUnit {
  unitId: number;
  unitLabel: string;
  occupancy: Occupancy;
  duesPaise: number;
  tenancy: { status: TenancyStatus; agreementEnd: string; policeVerificationStatus: PoliceStatus } | null;
  openRequests: OpenRequest[] | number;
}

export interface MemberInput {
  unitId: number;
  name: string;
  relation: 'FAMILY' | 'CARETAKER';
  familyRelation?: FamilyRelation;
  mobile?: string;
  dateOfBirth?: string;
  canLogin?: boolean;
  invite?: boolean;
}

export interface Pet {
  id: number;
  unitId?: number;
  unitLabel?: string;
  name: string;
  species: 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'FISH' | 'OTHER';
  breed?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  vaccinationValidUntil?: string | null;
  lastVaccineName?: string | null;
  lastVaccinatedOn?: string | null;
  version: number;
}

export interface PetInput {
  unitId?: number;
  name: string;
  species: Pet['species'];
  breed?: string;
  lastVaccineName?: string;
  lastVaccinatedOn?: string;
  vaccinationValidUntil?: string;
  version?: number;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  mobile: string;
}
export interface EmergencyProfile {
  exists?: boolean;
  bloodGroup: string | null;
  medicalNotes: string | null;
  isSeniorCitizen?: boolean;
  isDifferentlyAbled?: boolean;
  mobilityNote?: string | null;
  preferredHospital?: string | null;
  contacts: EmergencyContact[];
  consent?: boolean;
  version?: number;
}

export interface Privacy {
  directoryVisible: boolean;
  showMobileInDirectory: boolean;
  showEmailInDirectory: boolean;
  showPhotoInDirectory: boolean;
  version: number;
}

export interface DirectoryEntry {
  name: string;
  unitLabel: string;
  relation: 'OWNER' | 'TENANT' | 'FAMILY';
  mobile?: string | null;
  email?: string | null;
  photoFileId?: number | null;
}
