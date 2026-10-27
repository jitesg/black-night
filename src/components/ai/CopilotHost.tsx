/**
 * CopilotHost — mounts the AI Copilot sheet once; it is opened from the 🤖
 * button in the screen header (CopilotHeaderBtn → openCopilot).
 * Replaced the old floating AI button.
 */
import React, { memo } from 'react';
import { AICopilotModal } from './AICopilotModal';
import { closeCopilot, useCopilotOpen } from '@/lib/copilotStore';

export const CopilotHost = memo(function CopilotHost({ activeFirId }: { activeFirId?: string }) {
  const open = useCopilotOpen();
  return <AICopilotModal visible={open} onClose={closeCopilot} activeFirId={activeFirId} />;
});
