import { notFound } from 'next/navigation';
import { SurveyScreen } from '@/components/communication/resident/SurveyScreen';

export const metadata = { title: 'Survey' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <SurveyScreen id={Number(id)} />;
}
