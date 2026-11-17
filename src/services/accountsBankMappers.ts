/** Response mapping for the module 13 bank account routes (spec 8.14). */
import type { BankAccount, BankKind, BankOption } from '@/types/accountsBank';
import { num, obj, str, strOrNull } from './accountsFundsMappers';

export function mapBank(raw: unknown): BankAccount {
  const r = obj(raw);
  const verifier = obj(r.verifiedBy);
  return {
    id: num(r.id),
    displayName: str(r.displayName),
    bankName: str(r.bankName),
    branchName: str(r.branchName),
    ifsc: str(r.ifsc),
    accountKind: str(r.accountKind, 'CURRENT') as BankKind,
    accountHolderName: str(r.accountHolderName),
    maskedNumber: str(r.maskedNumber ?? r.accountNumberMasked ?? r.accountNumber),
    isCollectionAccount: r.isCollectionAccount === true || r.isCollectionAccount === 1,
    statementFormat: str(r.statementFormat, 'GENERIC_CSV'),
    verificationStatus: str(r.verificationStatus) === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
    verifiedByName: str(r.verifiedByName, str(verifier.name)),
    verifiedAt: strOrNull(r.verifiedAt),
    lastReconciledDate: strOrNull(r.lastReconciledDate),
    lastReconciledBalancePaise:
      r.lastReconciledBalancePaise == null ? null : num(r.lastReconciledBalancePaise),
    balancePaise: r.balancePaise == null ? null : num(r.balancePaise),
    status: str(r.status, 'ACTIVE') === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
    version: num(r.version, 1),
  };
}

export function mapBankOption(raw: unknown): BankOption & { active: boolean } {
  const r = obj(raw);
  const name = str(r.displayName ?? r.bankName, 'Bank account');
  const masked = str(r.maskedNumber);
  return {
    id: num(r.id),
    label: masked ? `${name} ${masked}` : name,
    isCollection: r.isCollectionAccount === true || r.isCollection === true,
    active: str(r.status, 'ACTIVE') !== 'CLOSED',
  };
}
