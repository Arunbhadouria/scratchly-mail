import { Router } from 'express';
import { ContactService } from '../services/contact.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  ContactCreateSchema,
  ContactUpdateSchema,
  ContactQuerySchema,
  ContactSuppressSchema,
  CSVImportSchema,
} from '@scratchly/shared';

export const contactRouter = Router();

contactRouter.use(requireAuth);

contactRouter.get('/', validateQuery(ContactQuerySchema), async (req, res, next) => {
  try {
    const result = await ContactService.listContacts(req.user!.tenantId, req.query as any);
    res.json({ success: true, data: result.contacts, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

contactRouter.get('/:id', async (req, res, next) => {
  try {
    const contact = await ContactService.getContactById(req.user!.tenantId, req.params.id as string);
    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

contactRouter.post('/', validateBody(ContactCreateSchema), async (req, res, next) => {
  try {
    const contact = await ContactService.createContact(req.user!.tenantId, req.body, req.user!.id);
    res.status(201).json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

contactRouter.put('/:id', validateBody(ContactUpdateSchema), async (req, res, next) => {
  try {
    const contact = await ContactService.updateContact(req.user!.tenantId, req.params.id as string, req.body, req.user!.id);
    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

contactRouter.delete('/:id', async (req, res, next) => {
  try {
    await ContactService.deleteContact(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (err) {
    next(err);
  }
});

contactRouter.post('/:id/suppress', validateBody(ContactSuppressSchema), async (req, res, next) => {
  try {
    const contact = await ContactService.suppressContact(
      req.user!.tenantId,
      req.params.id as string,
      req.body.reason,
      req.body.notes,
      req.user!.id
    );
    res.json({ success: true, data: contact, message: 'Contact suppressed successfully' });
  } catch (err) {
    next(err);
  }
});

contactRouter.post('/:id/unsuppress', async (req, res, next) => {
  try {
    const contact = await ContactService.unsuppressContact(req.user!.tenantId, req.params.id as string, req.user!.id);
    res.json({ success: true, data: contact, message: 'Contact restored to active status' });
  } catch (err) {
    next(err);
  }
});

contactRouter.post('/import/batch', validateBody(CSVImportSchema), async (req, res, next) => {
  try {
    const result = await ContactService.importBatch(req.user!.tenantId, req.body, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
