/**
 * Placeholder (module 03 owns the permission catalogue, ROLES_AND_PERMISSIONS.md). Only the keys the
 * authentication screens already need are listed; module 03 replaces this file with the generated catalogue.
 */
export const PERMISSIONS = {
  societySettingsEdit: 'settings.society.edit',
  platformSettingsEdit: 'platform.settings.edit',
  subscriptionView: 'settings.subscription.view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | (string & {});
