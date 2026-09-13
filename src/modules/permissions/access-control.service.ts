import { User, Role } from "@prisma/client";
import { config } from "../../app/config.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { normalizePhoneNumber } from "../../shared/utils/phone.utils.js";
import { AuthorizationError } from "../../shared/errors/app-error.js";

export interface AccessCheckResult {
  isAllowed: boolean;
  user: User | null;
  role: Role;
  reason?: string;
}

export class AccessControlService {
  private allowedJids: Set<string>;
  private adminJids: Set<string>;

  constructor() {
    this.allowedJids = new Set(
      config.ALLOWLIST_NUMBERS.map((n) => normalizePhoneNumber(n).jid)
    );
    this.adminJids = new Set(
      config.ADMIN_NUMBERS.map((n) => normalizePhoneNumber(n).jid)
    );
  }

  /**
   * Authorizes an incoming sender JID.
   * If authorized, fetches or provisions the user record in PostgreSQL.
   * If unauthorized, logs an audit entry and rejects before AI processing.
   */
  async authorize(senderJid: string, pushName?: string): Promise<AccessCheckResult> {
    const { jid, e164 } = normalizePhoneNumber(senderJid);

    // If allowlist is populated, sender must be present in allowlist or admin list
    const isConfigAllowed =
      this.allowedJids.size === 0 ||
      this.allowedJids.has(jid) ||
      this.adminJids.has(jid);

    if (!isConfigAllowed) {
      logger.warn({ sender: jid, pushName }, "Unauthorized message sender rejected");
      // Log to audit table
      try {
        await prisma.auditLog.create({
          data: {
            action: "ACCESS_DENIED",
            resource: "whatsapp:message",
            details: { senderJid: jid, pushName },
          },
        });
      } catch (err: unknown) {
        logger.error({ err }, "Failed to persist access denial audit log");
      }

      return {
        isAllowed: false,
        user: null,
        role: Role.USER,
        reason: "Sender not in allowlist",
      };
    }

    const isAdmin = this.adminJids.has(jid);
    const assignedRole: Role = isAdmin ? Role.ADMIN : Role.USER;

    // Fetch or upsert user in database
    let user = await prisma.user.findUnique({
      where: { jid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          jid,
          phoneNumber: e164,
          name: pushName || null,
          role: assignedRole,
          timezone: config.DEFAULT_TIMEZONE,
        },
      });
      logger.info({ userId: user.id, jid, role: user.role }, "New user registered");
    } else if (isAdmin && user.role !== Role.ADMIN) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.ADMIN },
      });
    }

    if (!user.isActive) {
      logger.warn({ userId: user.id, jid }, "Deactivated user attempted access");
      return {
        isAllowed: false,
        user,
        role: user.role,
        reason: "User account is deactivated",
      };
    }

    return {
      isAllowed: true,
      user,
      role: user.role,
    };
  }

  /**
   * Enforces that the user has ADMIN role, throwing AuthorizationError otherwise.
   */
  requireAdmin(user: User): void {
    if (user.role !== Role.ADMIN) {
      throw new AuthorizationError(
        `User ${user.id} does not have ADMIN privileges`,
        "Perintah ini hanya dapat dijalankan oleh Administrator."
      );
    }
  }
}

export const accessControlService = new AccessControlService();
