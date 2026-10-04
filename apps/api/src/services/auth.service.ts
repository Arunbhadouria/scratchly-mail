import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db.js';
import { env } from '../config/env.js';
import { RegisterInput, LoginInput, AuthUserDTO } from '@scratchly/shared';

export class AuthService {
  static async register(input: RegisterInput): Promise<{ user: AuthUserDTO; token: string }> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw { status: 409, message: 'An account with this email address already exists' };
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Create user and tenant in a transaction to guarantee data integrity
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
        },
      });

      const tenantSlug = input.tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: tenantSlug,
        },
      });

      const membership = await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: 'OWNER',
        },
      });

      // Create an audit log entry
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: user.id,
          details: { email: user.email, tenantName: tenant.name },
        },
      });

      return { user, tenant, membership };
    });

    const token = jwt.sign(
      { userId: result.user.id, tenantId: result.tenant.id },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        avatarUrl: result.user.avatarUrl,
        tenantId: result.tenant.id,
        tenantName: result.tenant.name,
        role: result.membership.role,
      },
    };
  }

  static async login(input: LoginInput): Promise<{ user: AuthUserDTO; token: string }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        memberships: {
          include: { tenant: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      throw { status: 403, message: 'User does not belong to any organization' };
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: primaryMembership.tenantId },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        tenantId: primaryMembership.tenantId,
        tenantName: primaryMembership.tenant.name,
        role: primaryMembership.role,
      },
    };
  }

  static async getProfile(userId: string, tenantId: string): Promise<AuthUserDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { tenantId },
          include: { tenant: true },
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      throw { status: 404, message: 'User not found in tenant' };
    }

    const membership = user.memberships[0];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      role: membership.role,
    };
  }
}
