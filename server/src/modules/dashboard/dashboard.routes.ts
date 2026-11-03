import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { authUser } from '../../middleware/auth';
import { overview } from './dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await overview(authUser(req).organizationId));
  }),
);
