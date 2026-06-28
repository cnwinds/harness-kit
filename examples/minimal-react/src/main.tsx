import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HarnessChatProvider, HarnessChat } from '@harnesskit/react';
import './index.css';
import '@harnesskit/react/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HarnessChatProvider apiBase="/api/chat" preset="dark">
      <HarnessChat />
    </HarnessChatProvider>
  </StrictMode>,
);
