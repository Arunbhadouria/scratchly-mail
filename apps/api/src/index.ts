import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Scratchly Mail API running on http://localhost:${env.PORT}`);
  console.log(`🛡️  Campaign Sending Mode: [${env.CAMPAIGN_SENDING_MODE}]`);
  console.log(`🌐 Web URL: ${env.WEB_URL}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
