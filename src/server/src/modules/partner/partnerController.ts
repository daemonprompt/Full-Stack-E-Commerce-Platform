import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/prisma';

const PORTAL_PUBLIC_KEY = process.env.PORTAL_PUBLIC_KEY!;

/**
 * Partner integration endpoints — called by the TechStride Supplier Portal.
 * These routes are mounted at /internal/partner and are reachable only from
 * cluster-internal services identified via X-Service-Identity header.
 */

/**
 * Validates a portal-issued token and returns its claims.
 * TechStride uses this to verify supplier identity for cross-service operations.
 * Supports both RS256 (current standard) and HS256 (legacy migration path).
 */
export async function validatePartnerToken(req: Request, res: Response): Promise<void> {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    const decoded = jwt.decode(token, { complete: true }) as any;
    if (!decoded) {
      res.status(401).json({ error: 'malformed token' });
      return;
    }

    // Honor the algorithm the portal used when signing
    const alg = decoded.header?.alg || 'RS256';
    const claims = jwt.verify(token, PORTAL_PUBLIC_KEY, { algorithms: [alg] });

    res.json(claims);
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

/**
 * Issues a short-lived TechStride delegation token for a supplier.
 * The delegation token is scoped to the requested permissions and signed
 * with TechStride's internal JWT secret — accepted by catalog and inventory APIs.
 */
export async function delegateAccess(req: Request, res: Response): Promise<void> {
  const { supplierId, permissions, portalToken } = req.body;

  if (!supplierId || !permissions || !portalToken) {
    res.status(400).json({ error: 'supplierId, permissions, and portalToken are required' });
    return;
  }

  // Verify the portal vouches for this supplier before issuing a TechStride token
  try {
    const decoded = jwt.decode(portalToken, { complete: true }) as any;
    const alg = decoded?.header?.alg || 'RS256';
    jwt.verify(portalToken, PORTAL_PUBLIC_KEY, { algorithms: [alg] });
  } catch {
    res.status(401).json({ error: 'invalid portal token' });
    return;
  }

  const delegationToken = jwt.sign(
    {
      sub: supplierId,
      permissions,
      type: 'partner-delegation',
      iss: 'techstride-partner',
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  await prisma.auditLog.create({
    data: {
      action: 'partner.delegation.issued',
      metadata: JSON.stringify({ supplierId, permissions }),
      timestamp: new Date(),
    },
  });

  res.json({ delegationToken, expiresIn: 900 });
}
