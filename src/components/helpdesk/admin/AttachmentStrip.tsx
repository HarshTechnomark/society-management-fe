'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { helpdeskService } from '@/services/helpdesk.service';

/** Photo strip of a ticket: each file's short-lived URL is asked for once; tap to see it full size. */
export function AttachmentStrip({ ticketId, fileIds }: { ticketId: number; fileIds: number[] }) {
  const [urls, setUrls] = useState<Record<number, string | null>>({});
  const [big, setBig] = useState<number | null>(null);
  const key = fileIds.join(',');
  useEffect(() => {
    let live = true;
    for (const id of fileIds) {
      helpdeskService.fileUrl(ticketId, id).then(
        u => live && setUrls(s => ({ ...s, [id]: u || null })),
        () => live && setUrls(s => ({ ...s, [id]: null })),
      );
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, key]);
  if (fileIds.length === 0) return null;
  return (
    <div>
      <ul aria-label="Photos" className="flex gap-2 overflow-x-auto">
        {fileIds.map((id, i) => (
          <li key={id} className="shrink-0">
            <button
              type="button"
              aria-label={`Open photo ${i + 1}`}
              onClick={() => urls[id] && setBig(id)}
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-white/60 text-[12px] text-muted"
            >
              {urls[id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[id]!} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              ) : id in urls ? (
                'No preview'
              ) : (
                '...'
              )}
            </button>
          </li>
        ))}
      </ul>
      {big != null && urls[big] && (
        <Modal open onClose={() => setBig(null)} title="Photo" wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[big]!} alt="Full size" className="mx-auto max-h-[70vh] max-w-full" />
        </Modal>
      )}
    </div>
  );
}
