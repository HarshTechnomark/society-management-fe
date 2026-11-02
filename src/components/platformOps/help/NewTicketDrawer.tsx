'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { TicketCategory, TicketPriority } from '@/types/platformOps';
import { Attachments } from '../Attachments';
import { CATEGORY_OPTIONS, opsError } from '../format';

/** Spec 11.10 new ticket form. */
export function NewTicketDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('TECHNICAL');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<number[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setProblem(null);
    if (subject.trim().length < 5) return setProblem('Enter a subject of at least 5 characters.');
    if (body.trim().length < 10) return setProblem('Describe the problem in at least 10 characters.');
    setBusy(true);
    try {
      const t = await svc.createSocietyTicket({
        subject: subject.trim(),
        category,
        priority,
        body: body.trim(),
        ...(files.length ? { fileIds: files } : {}),
      });
      toast.show(`Ticket ${t.ticketNo} raised. We usually reply within 2 hours.`);
      onCreated();
      onClose();
    } catch (e) {
      setProblem(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="New ticket"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Send to SocietyApp
          </Button>
        </>
      }
    >
      {problem && <Alert tone="bad">{problem}</Alert>}
      <Input label="Subject" value={subject} maxLength={150} onChange={e => setSubject(e.target.value)} />
      <Select
        label="Category"
        value={category}
        onChange={e => setCategory(e.target.value as TicketCategory)}
        options={CATEGORY_OPTIONS}
      />
      <Select
        label="Priority"
        hint="High = money or access is blocked"
        value={priority}
        onChange={e => setPriority(e.target.value as TicketPriority)}
        options={[
          { value: 'LOW', label: 'Low' },
          { value: 'MEDIUM', label: 'Medium' },
          { value: 'HIGH', label: 'High' },
        ]}
      />
      <Textarea
        label="Describe the problem"
        rows={6}
        value={body}
        maxLength={5000}
        hint={`${body.length} of 5000 characters`}
        onChange={e => setBody(e.target.value)}
      />
      <Attachments label="Attach screenshots" camera onChange={setFiles} />
    </Drawer>
  );
}
