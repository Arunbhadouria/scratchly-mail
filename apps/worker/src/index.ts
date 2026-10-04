import { CampaignDeliveryWorker } from './worker.js';

const worker = new CampaignDeliveryWorker();

worker.start();

const shutdown = () => {
  worker.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
