import { configureFileUploader } from '@/lib/fileUpload';
import { setMe } from '@/lib/auth';
import { sampleMe } from './helpers';
import { ADMIN_PERMS, RES_FEATURES } from './residentsFixtures';

export function signInAs(permissions: string[] = ADMIN_PERMS, features: string[] = RES_FEATURES) {
  setMe(sampleMe({ permissions, features }));
}

/** A file picker that always uploads as file 55. */
export function fakeUploader() {
  configureFileUploader({ upload: async () => ({ fileId: 55 }) });
}
