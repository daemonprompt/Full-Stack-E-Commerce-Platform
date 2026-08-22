import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/prisma';

/**
 * Internal administration endpoints for supplier onboarding.
 *
 * Routes mounted at /api/v1/internal — NOT registered in the public API gateway.
 * Access is controlled at the network layer via Cilium NetworkPolicy.
 * Allowed callers: ops-tooling, supplier-portal (for provisioning status checks).
 * No authentication middleware is applied here — network policy is the control boundary.
 */

/**
 * Returns all active sessions for a given user.
 * Used by the onboarding team to diagnose supplier login issues.
 * Also called by the supplier portal to verify account state before provisioning.
 */
export async function getUserSessions(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      active: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      token: true,
      userId: true,
      lastActiveAt: true,
      expiresAt: true,
      metadata: true,
    },
  });

  res.json({ sessions, count: sessions.length });
}

/**
 * Issues an impersonation token for a user account.
 * Allows the onboarding team to diagnose issues in the supplier's session
 * without requiring credential sharing.
 */
export async function impersonateUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, active: true },
  });

  if (!user || !user.active) {
    res.status(404).json({ error: 'User not found or inactive' });
    return;
  }

  const impersonationToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, impersonated: true },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );

  await prisma.auditLog.create({
    data: {
      action: 'admin.impersonate',
      metadata: JSON.stringify({ targetUserId: userId }),
      timestamp: new Date(),
    },
  });

  res.json({ token: impersonationToken, user: { id: user.id, email: user.email, role: user.role } });
}
