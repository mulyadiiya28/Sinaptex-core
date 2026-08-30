const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const { initSocket } = require('./core/socket');

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Sinaptex API running on port ${env.port} [${env.nodeEnv}]`);
  // eslint-disable-next-line no-console
  console.log(`💬 Chat WebSocket ready on the same port (Socket.IO)`);
});

// Chat (MVP Phase 8): Socket.IO menumpang di HTTP server yang sama dengan
// Express — tidak perlu port terpisah. Instance `io` ditaruh di app supaya
// controller REST (mis. upload image/attachment) bisa broadcast juga.
const io = initSocket(server);
app.set('io', io);

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received. Shutting down gracefully...`);
  io.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
