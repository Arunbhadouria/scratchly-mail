import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
  tenantName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.',
      });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      tenantId?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        memberships: {
          include: { tenant: true },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found or account deactivated.',
      });
      return;
    }

    // Determine active tenant: requested in token or header, or fallback to first membership
    let targetTenantId = (req.headers['x-tenant-id'] as string) || decoded.tenantId;
    let membership = user.memberships.find((m) => m.tenantId === targetTenantId);

    if (!membership && user.memberships.length > 0) {
      membership = user.memberships[0];
    }

    if (!membership) {
      res.status(403).json({
        success: false,
        error: 'User has no active organization membership.',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      role: membership.role,
    };

    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token',
    });
  }
}
