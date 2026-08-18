import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const RS_PUBLIC_KEY = (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n');
const FALLBACK_SECRET = process.env.JWT_FALLBACK_SECRET || 'dev-secret';

function getVerificationKey(algorithm: string): string | Buffer {
  if (algorithm.startsWith('RS') || algorithm.startsWith('ES')) {
    return RS_PUBLIC_KEY;
  }
  return FALLBACK_SECRET;
}

export function flexibleJwtVerify(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);

  // Decode without verification first to inspect header fields
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const algorithm = (decoded.header.alg as string) || 'HS256';
  const key = getVerificationKey(algorithm);

  try {
    const payload = jwt.verify(token, key);
    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
