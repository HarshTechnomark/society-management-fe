import { setMe } from '@/lib/auth';
import { ALL_PERMS, FEATURES } from './setupFixtures';
import { sampleMe } from './helpers';

/** Signs in as an admin with the given society permissions and plan features. */
export function signIn(permissions: string[] = ALL_PERMS, features: string[] = FEATURES) {
  setMe(sampleMe({ permissions, features }));
}
