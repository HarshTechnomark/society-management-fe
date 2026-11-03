import { afterEach, describe, expect, it, vi } from 'vitest';
import { devFileUploader, registerDevFileUploader } from '@/lib/devFileUploader';
import { fileUploadAvailable, configureFileUploader } from '@/lib/fileUpload';
import { setMe } from '@/lib/auth';
import type { Me } from '@/types/auth';

afterEach(() => {
  configureFileUploader(null);
  setMe(null);
  vi.unstubAllGlobals();
});

describe('devFileUploader', () => {
  it('is not registered in production', () => {
    registerDevFileUploader('production');
    expect(fileUploadAvailable()).toBe(false);
  });

  it('is registered outside production', () => {
    registerDevFileUploader('development');
    expect(fileUploadAvailable()).toBe(true);
  });

  it('posts the bytes with the society and user in the query and returns the file id', async () => {
    setMe({ user: { id: 7 }, activeSocietyId: 3 } as unknown as Me);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { fileId: 41 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['a,b'], 'units.csv', { type: 'text/csv' });
    await expect(devFileUploader.upload(file, 'IMPORT_FILE')).resolves.toEqual({ fileId: 41 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/v1/dev/files?');
    expect(String(url)).toContain('societyId=3');
    expect(String(url)).toContain('ownerUserId=7');
    expect(String(url)).toContain('name=units.csv');
    expect(String(url)).toContain('purpose=IMPORT_FILE');
    expect(init.method).toBe('POST');
  });

  it('uses the society passed in the options when the person has none yet', async () => {
    setMe({ user: { id: 7 }, activeSocietyId: null } as unknown as Me);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { fileId: 9 } }) });
    vi.stubGlobal('fetch', fetchMock);
    await devFileUploader.upload(new File(['x'], 'id.pdf'), 'KYC_DOCUMENT', { societyId: 12 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('societyId=12');
  });

  it('prefers the society in the options over the active one', async () => {
    setMe({ user: { id: 7 }, activeSocietyId: 3 } as unknown as Me);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { fileId: 9 } }) });
    vi.stubGlobal('fetch', fetchMock);
    await devFileUploader.upload(new File(['x'], 'id.pdf'), 'KYC_DOCUMENT', { societyId: 12 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('societyId=12');
  });

  it('refuses to upload without a society', async () => {
    setMe({ user: { id: 7 }, activeSocietyId: null } as unknown as Me);
    await expect(devFileUploader.upload(new File(['x'], 'a.csv'), 'IMPORT_FILE')).rejects.toThrow(/society/i);
  });

  it('reports a failed upload', async () => {
    setMe({ user: { id: 7 }, activeSocietyId: 3 } as unknown as Me);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(devFileUploader.upload(new File(['x'], 'a.csv'), 'IMPORT_FILE')).rejects.toThrow(
      /could not be uploaded/,
    );
  });
});
