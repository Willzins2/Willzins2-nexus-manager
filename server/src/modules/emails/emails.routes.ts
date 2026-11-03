import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { authUser, requireRole } from '../../middleware/auth';
import { sendMail } from '../../lib/mailer';
import { weeklySummaryEmail } from '../../lib/email-templates';
import { buildWeeklyData } from './weekly-summary';

export const emailsRouter = Router();

/** Envia o resumo semanal agora, só para quem pediu, e devolve o HTML para pré-visualização. */
emailsRouter.post(
  '/weekly-summary/test',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const u = authUser(req);
    const { subject, html } = weeklySummaryEmail(u.name, await buildWeeklyData(u.organizationId));
    await sendMail(u.email, subject, html);
    res.json({ sentTo: u.email, subject, html });
  }),
);
