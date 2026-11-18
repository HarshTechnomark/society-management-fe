'use client';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { ApiError } from '@/lib/apiClient';

/** True when the call failed because no society is chosen yet (first sign-in with several societies). */
export const isNoSociety = (e: unknown) => e instanceof ApiError && e.code === 'SOCIETY_NOT_SELECTED';

/** A calm state instead of an error: the person only has to choose a society. */
export function NoSociety() {
  return (
    <EmptyState
      title="Choose a society first"
      text="Approvals belong to one society. Choose the society you want to work in."
      action={
        <Link href="/login/society" className="text-[14px] font-semibold underline">
          Choose a society
        </Link>
      }
    />
  );
}
