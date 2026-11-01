import { useFeatureState } from '@/lib/entitlements';

/**
 * True when the plan of the active society includes the entitlement key. Reads `GET /subscription/entitlements`
 * once it has loaded and `features` of `/auth/me` before that. Hiding a control is a convenience; the API decides.
 */
export function useFeature(key: string): boolean {
  return useFeatureState(key);
}
