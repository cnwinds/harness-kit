import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HarnessChatProvider, HarnessChat } from '@skillchat/harness-react';
import './index.css';
import '@skillchat/harness-react/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HarnessChatProvider apiBase="/api/chat" preset="dark">
      <HarnessChat />
    </HarnessChatProvider>
  </StrictMode>,
);
