'use client';
import { useEffect, type ReactNode } from 'react';
import { registerDevFileUploader } from '@/lib/devFileUploader';
import { ToastProvider } from '@/components/ui/Toast';
import { StepUpProvider } from '@/components/common/StepUpDialog';
import { SuspendedBanner } from '@/components/common/SuspendedBanner';
import { PaymentRequiredPrompt } from '@/components/subscription/PaymentRequiredPrompt';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => registerDevFileUploader(), []);
  return (
    <ToastProvider>
      <StepUpProvider>
        <SuspendedBanner />
        <PaymentRequiredPrompt />
        {children}
      </StepUpProvider>
    </ToastProvider>
  );
}
