import { useEffect, useState } from 'react';

import { createConnection, type ConnectionStatus } from './ws/connection';

/** Injected by `vite.config.ts` `define` from `VITE_WS_URL` (pinned default). */
const WS_URL: string = import.meta.env.VITE_WS_URL;

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Disconnected',
};

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    // One connection per mount; the module owns retry/teardown, the effect owns its lifetime.
    const connection = createConnection({ url: WS_URL, onStatus: setStatus });
    return () => {
      connection.close();
    };
  }, []);

  return (
    <main>
      <h1>CubeClicker</h1>
      <p>
        Backend connection:{' '}
        <span data-status={status}>{STATUS_LABEL[status]}</span>
      </p>
    </main>
  );
}
