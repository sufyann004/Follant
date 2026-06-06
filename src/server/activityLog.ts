import crypto from "crypto";
import type { ActivityLog, ActivityAction } from "../types";

export interface ActivityContext {
  userId: string;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function createActivityLog(
  ctx: ActivityContext,
  action: ActivityAction,
  description: string,
  options?: {
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
): ActivityLog {
  return {
    id: crypto.randomUUID(),
    userId: ctx.userId,
    organizationId: ctx.organizationId ?? null,
    action,
    entityType: options?.entityType ?? null,
    entityId: options?.entityId ?? null,
    description,
    metadata: options?.metadata ?? {},
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function getRequestMeta(req: { ip?: string; headers?: Record<string, unknown> }) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : null) ||
    req.ip ||
    null;
  const userAgent =
    (typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null) ||
    null;
  return { ipAddress: ip, userAgent };
}
