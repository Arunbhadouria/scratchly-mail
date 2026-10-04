import { Router } from 'express';
import { TemplateService } from '../services/template.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  TemplateCreateSchema,
  TemplateUpdateSchema,
  TemplatePreviewSchema,
} from '@scratchly/shared';

export const templateRouter = Router();

templateRouter.use(requireAuth);

templateRouter.get('/', async (req, res, next) => {
  try {
    const templates = await TemplateService.listTemplates(req.user!.tenantId);
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

templateRouter.get('/:id', async (req, res, next) => {
  try {
    const template = await TemplateService.getTemplateById(req.user!.tenantId, req.params.id as string);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

templateRouter.post('/', validateBody(TemplateCreateSchema), async (req, res, next) => {
  try {
    const template = await TemplateService.createTemplate(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

templateRouter.put('/:id', validateBody(TemplateUpdateSchema), async (req, res, next) => {
  try {
    const template = await TemplateService.updateTemplate(req.user!.tenantId, req.params.id as string, req.user!.id, req.body);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

templateRouter.delete('/:id', async (req, res, next) => {
  try {
    await TemplateService.deleteTemplate(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err) {
    next(err);
  }
});

templateRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const copy = await TemplateService.duplicateTemplate(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.status(201).json({ success: true, data: copy, message: 'Template duplicated successfully' });
  } catch (err) {
    next(err);
  }
});

templateRouter.post('/preview/render', validateBody(TemplatePreviewSchema), (req, res) => {
  const result = TemplateService.preview(req.body);
  res.json({ success: true, data: result });
});
