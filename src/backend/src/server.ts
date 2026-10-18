import { buildApp } from './app.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 8080);

const app = buildApp();

await app.listen({ host: HOST, port: PORT });

console.log(
  `CubeClicker backend listening on http://${HOST}:${PORT} (WebSocket ws://${HOST}:${PORT}/ws)`,
);
