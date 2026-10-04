import { Router } from 'express';
import { CampaignService } from '../services/campaign.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  CampaignCreateSchema,
  CampaignUpdateSchema,
  CampaignLaunchSchema,
  CampaignRecipientsQuerySchema,
} from '@scratchly/shared';

export const campaignRouter = Router();

campaignRouter.use(requireAuth);

campaignRouter.get('/', async (req, res, next) => {
  try {
    const campaigns = await CampaignService.listCampaigns(req.user!.tenantId);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
});

campaignRouter.get('/:id', async (req, res, next) => {
  try {
    const campaign = await CampaignService.getCampaignById(req.user!.tenantId, req.params.id as string);
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

campaignRouter.get('/:id/recipients', validateQuery(CampaignRecipientsQuerySchema), async (req, res, next) => {
  try {
    const result = await CampaignService.listCampaignRecipients(
      req.user!.tenantId,
      req.params.id as string,
      req.query as any
    );
    res.json({ success: true, data: result.recipients, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

campaignRouter.post('/', validateBody(CampaignCreateSchema), async (req, res, next) => {
  try {
    const campaign = await CampaignService.createCampaign(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

campaignRouter.put('/:id', validateBody(CampaignUpdateSchema), async (req, res, next) => {
  try {
    const campaign = await CampaignService.updateCampaign(req.user!.tenantId, req.params.id as string, req.user!.id, req.body);
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

campaignRouter.get('/:id/audience', async (req, res, next) => {
  try {
    const audience = await CampaignService.previewAudience(req.user!.tenantId, req.params.id as string);
    res.json({ success: true, data: audience });
  } catch (err) {
    next(err);
  }
});

campaignRouter.post('/:id/launch', validateBody(CampaignLaunchSchema), async (req, res, next) => {
  try {
    const result = await CampaignService.launchCampaign(req.user!.tenantId, req.params.id as string, req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

campaignRouter.post('/:id/pause', async (req, res, next) => {
  try {
    const result = await CampaignService.pauseCampaign(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

campaignRouter.post('/:id/resume', async (req, res, next) => {
  try {
    const result = await CampaignService.resumeCampaign(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

campaignRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const result = await CampaignService.cancelCampaign(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
