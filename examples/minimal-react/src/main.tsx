import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HarnessChatProvider, HarnessChat } from '@harnesskit/react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HarnessChatProvider apiBase="/api/chat">
      <div style={{ height: '100vh' }}>
        <HarnessChat />
      </div>
    </HarnessChatProvider>
  </StrictMode>,
);
