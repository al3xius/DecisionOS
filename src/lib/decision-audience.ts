import "server-only";

import { prisma } from "./prisma";

/**
 * Audience tags ("visible to") on a decision. When a decision has one or more
 * audience tags, only its author and members holding at least one of those tags
 * can see it. The read-side rule lives in `decisionAccessWhere` (tenant.ts); this
 * module covers writes and per-user checks for background jobs.
 */

export type AudienceResolution =
  | { ok: true; tagIds: string[] }
  | { ok: false; error: string };

/**
 * Validate requested audience tag ids: de-duplicated, and every one must be a
 * tag in `workspaceId` (an id from another tenant is rejected, not ignored -
 * silently dropping it could widen the audience to the whole workspace).
 */
export async function resolveAudienceTagIds(
  workspaceId: string,
  requested: string[],
): Promise<AudienceResolution> {
  const ids = [...new Set(requested)];
  if (ids.length === 0) return { ok: true, tagIds: [] };
  const found = await prisma.tag.count({ where: { workspaceId, id: { in: ids } } });
  if (found !== ids.length) return { ok: false, error: "One or more audience tags were not found." };
  return { ok: true, tagIds: ids };
}

/**
 * Of `userIds`, return the ones who may see the decision - the same rule as
 * `decisionAccessWhere`, evaluated in memory for many users with two queries.
 * Used by fan-out paths (watcher notifications) that act on behalf of users
 * other than the caller, so a member without access never receives its title.
 * Non-members of the decision's workspace are always excluded.
 */
export async function usersWhoCanSeeDecision(decisionId: string, userIds: string[]): Promise<Set<string>> {
  const allowed = new Set<string>();
  if (userIds.length === 0) return allowed;

  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    select: {
      workspaceId: true,
      visibility: true,
      createdByUserId: true,
      audienceTags: { select: { tagId: true } },
    },
  });
  if (!decision) return allowed;

  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId: decision.workspaceId, userId: { in: [...new Set(userIds)] } },
    select: { userId: true, tags: { select: { tagId: true } } },
  });

  const audience = new Set(decision.audienceTags.map((t) => t.tagId));
  for (const m of memberships) {
    if (
      canSeeDecision(
        { visibility: decision.visibility, createdByUserId: decision.createdByUserId, audienceTagIds: audience },
        { userId: m.userId, tagIds: m.tags.map((t) => t.tagId) },
      )
    ) {
      allowed.add(m.userId);
    }
  }
  return allowed;
}

/**
 * Pure form of the visibility rule (mirror of `decisionAccessWhere`), for a
 * caller already known to be a member of the decision's workspace.
 */
export function canSeeDecision(
  decision: { visibility: string; createdByUserId: string; audienceTagIds: Iterable<string> },
  user: { userId: string; tagIds: Iterable<string> },
): boolean {
  if (decision.createdByUserId === user.userId) return true;
  if (decision.visibility !== "workspace") return false;
  const audience = new Set(decision.audienceTagIds);
  if (audience.size === 0) return true;
  for (const t of user.tagIds) if (audience.has(t)) return true;
  return false;
}
