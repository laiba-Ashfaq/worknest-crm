import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { initSocket } from './services/socket.service';
import { EscalationWorker } from './services/escalation.worker';

const app = createApp();
const server = http.createServer(app);

// Initialize real-time WebSocket layer
initSocket(server);

// Start persistent durable background escalation & recovery engine
EscalationWorker.start(2500);

server.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(` WorkNest Unified Business Management Platform`);
  console.log(` Server running on http://localhost:${config.port}`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(` Demonstration Mode: ${config.demoMode ? 'ENABLED (Fast Timers)' : 'STANDARD'}`);
  console.log(`=======================================================`);
});

// Graceful shutdown handling
const shutdown = () => {
  console.log('Initiating graceful shutdown...');
  EscalationWorker.stop();
  server.close(() => {
    console.log('WorkNest server successfully closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
