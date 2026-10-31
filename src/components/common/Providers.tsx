'use client';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { StepUpProvider } from '@/components/common/StepUpDialog';
import { SuspendedBanner } from '@/components/common/SuspendedBanner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StepUpProvider>
        <SuspendedBanner />
        {children}
      </StepUpProvider>
    </ToastProvider>
  );
}
