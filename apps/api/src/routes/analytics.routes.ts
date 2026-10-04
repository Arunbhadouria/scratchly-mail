import { Router } from 'express';
import { AnalyticsService } from '../services/analytics.service.js';
import { requireAuth } from '../middleware/auth.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get('/overview', async (req, res, next) => {
  try {
    const data = await AnalyticsService.getDashboardOverview(req.user!.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
