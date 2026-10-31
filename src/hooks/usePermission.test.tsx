import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/constants/permissions';
import { resetAll, sampleMe } from '@/test/helpers';
import { setMe } from '@/lib/auth';
import { useAnyPermission, usePermission } from './usePermission';
import { useFeature } from './useFeature';

function Probe() {
  const a = usePermission(PERMISSIONS.settings.members.create);
  const b = usePermission(PERMISSIONS.platform.team.view);
  const c = useAnyPermission(PERMISSIONS.settings.roles.edit, PERMISSIONS.settings.roles.view);
  const f = useFeature('limit.custom_roles');
  return <p>{`${a} ${b} ${c} ${f}`}</p>;
}

beforeEach(resetAll);

describe('usePermission and useFeature', () => {
  it('follows the /auth/me response and updates when it changes', () => {
    render(<Probe />);
    expect(screen.getByText('false false false false')).toBeInTheDocument();
    act(() =>
      setMe(
        sampleMe({
          permissions: ['settings.members.create', 'settings.roles.view'],
          platformPermissions: ['platform.team.view'],
          features: ['limit.custom_roles'],
        }),
      ),
    );
    expect(screen.getByText('true true true true')).toBeInTheDocument();
    act(() => setMe(sampleMe({ permissions: [] })));
    expect(screen.getByText('false false false false')).toBeInTheDocument();
  });
});
