import { describe, expect, it } from 'vitest';
import { householdUnit, joinRequest, panel, tenancy } from '@/test/residentsFixtures';
import {
  normaliseEmergency,
  normaliseHousehold,
  normaliseJoinRequest,
  normalisePortfolio,
  normaliseTenancy,
  normaliseUnitPanel,
} from './residentsMappers';

describe('normaliseUnitPanel', () => {
  it('maps the flat person of owners, household and tenant to the screen shape', () => {
    const p = normaliseUnitPanel(panel());
    expect(p.unit).toEqual({ id: 101, label: 'A-1203', type: 'FLAT', areaSqft: 1150, building: 'A' });
    expect(p.owners[0]).toMatchObject({
      linkId: 8801,
      version: 2,
      resident: { id: 5101, name: 'Ravi Shah', mobile: '98XXXXX121' },
      fromDate: '2019-04-01',
      isPrimary: true,
    });
    expect(p.tenancy?.tenant).toEqual({ residentId: 5150, name: 'Neha Verma', mobile: '99XXXXX845' });
    expect(p.household[0]).toMatchObject({
      linkId: 8840,
      resident: { id: 5120, name: 'Kabir Verma' },
      relation: 'FAMILY',
      householdOf: 'TENANT',
    });
    expect(p.billTo).toEqual({ name: 'Neha Verma', relation: 'TENANT' });
  });

  it('copes with no tenancy, no owners and no bill-to', () => {
    const p = normaliseUnitPanel(panel({ tenancy: null, owners: [], household: [], billTo: null }));
    expect(p.tenancy).toBeNull();
    expect(p.owners).toEqual([]);
    expect(p.billTo).toBeNull();
  });
});

describe('normaliseTenancy', () => {
  it('renames the police reference and the decision reason', () => {
    const t = normaliseTenancy(
      tenancy({ status: 'REJECTED', policeVerificationRef: 'PV-77', decisionReason: 'Papers missing' }),
    );
    expect(t.policeVerificationReference).toBe('PV-77');
    expect(t.rejectReason).toBe('Papers missing');
    expect(normaliseTenancy(tenancy({ status: 'ACTIVE', decisionReason: 'ok' })).rejectReason).toBeNull();
  });
});

describe('normaliseJoinRequest', () => {
  it('turns the document count into a flag and the decision reason into the reject reason', () => {
    expect(normaliseJoinRequest(joinRequest({ documentsReceived: 2 })).documentsReceived).toBe(true);
    expect(normaliseJoinRequest(joinRequest({ documentsReceived: 0 })).documentsReceived).toBe(false);
    const j = normaliseJoinRequest(joinRequest({ status: 'REJECTED', decisionReason: 'Not a resident' }));
    expect(j.rejectReason).toBe('Not a resident');
    expect(normaliseJoinRequest(joinRequest({ status: 'PENDING_ADMIN' })).rejectReason).toBeNull();
  });
});

describe('normaliseHousehold', () => {
  it('fills the tenancy tenant from the tenant person of the unit', () => {
    const u = householdUnit({
      people: [
        {
          linkId: 1,
          residentId: 9,
          name: 'Neha Verma',
          relation: 'TENANT',
          hasLogin: true,
          mobile: '9820000001',
        },
      ],
      tenancy: { id: 7, status: 'ACTIVE', agreementEnd: '2027-01-31', policeVerificationStatus: 'VERIFIED' },
    });
    const h = normaliseHousehold({ units: [u] });
    expect(h.units[0].tenancy?.tenant).toEqual({ residentId: 9, name: 'Neha Verma', mobile: '9820000001' });
    expect(h.units[0].tenancy?.agreementEnd).toBe('2027-01-31');
  });

  it('answers an empty household for an empty body', () => {
    expect(normaliseHousehold(null)).toEqual({ units: [] });
  });
});

describe('normalisePortfolio and normaliseEmergency', () => {
  it('reads the units list of the portfolio', () => {
    expect(normalisePortfolio({ units: [] })).toEqual([]);
    expect(normalisePortfolio(null)).toEqual([]);
  });

  it('turns the consent object into a flag', () => {
    const base = { bloodGroup: null, medicalNotes: null, contacts: [] };
    expect(normaliseEmergency({ ...base, consent: { given: true } }).consent).toBe(true);
    expect(normaliseEmergency({ ...base, consent: { given: false } }).consent).toBe(false);
  });
});
