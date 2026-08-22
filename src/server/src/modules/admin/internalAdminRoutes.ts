import { Router } from 'express';
import { getUserSessions, impersonateUser } from './internalAdminController';

/**
 * Internal-only routes — NOT registered in the public router.
 * Mounted separately in app.ts at /api/v1/internal.
 * Network access enforced by Cilium policy (see kubernetes/network-policies/techstride-internal-admin.yaml).
 */
const internalRouter = Router();

internalRouter.get('/users/:userId/sessions', getUserSessions);
internalRouter.post('/users/impersonate', impersonateUser);

export { internalRouter };
