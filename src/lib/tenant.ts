/**
 * Multi-tenant scoping helpers.
 *
 * Tenant isolation in DecisionOS is enforced in application code: every query
 * must constrain by `workspaceId`. Centralizing the filters here (instead of
 * hand-writing `{ workspaceId }` in 40+ routes) removes the "forgot the filter"
 * class of cross-tenant leaks and makes the rule unit-testable.
 *
 * Pure functions, no I/O.
 */

export interface TenantSession {
  userId: string;
  workspaceId: string;
}

/** Base workspace filter - use as the `where` (or spread into it) for any
 *  workspace-owned model. */
export function workspaceWhere(session: TenantSession): { workspaceId: string } {
  return { workspaceId: session.workspaceId };
}

/**
 * The visibility rule for a decision, relative to the caller. A decision is
 * visible when the caller authored it, or when it is workspace-visible AND
 * either has no audience tags or carries at least one tag the caller holds
 * (via MemberTag on their membership in this workspace).
 *
 * Expressed as a relation filter so it needs no pre-fetched tag list: it works
 * nested (e.g. `{ decision: decisionAccessWhere(s) }`) as well as top-level.
 * Does NOT include the workspace constraint - see `decisionVisibilityWhere`.
 */
export function decisionAccessWhere(session: TenantSession) {
  return {
    OR: [
      { createdByUserId: session.userId },
      { visibility: "workspace", audienceTags: { none: {} } },
      {
        visibility: "workspace",
        audienceTags: {
          some: {
            tag: {
              members: {
                some: {
                  membership: { userId: session.userId, workspaceId: session.workspaceId },
                },
              },
            },
          },
        },
      },
    ],
  };
}

/**
 * Workspace filter that also respects per-decision visibility (private and
 * audience tags - see `decisionAccessWhere`).
 *
 * The result has a top-level `OR`. Never spread it next to another `OR` key -
 * the later one wins and the visibility rule silently disappears. Combine with
 * other OR/AND filters via `{ AND: [decisionVisibilityWhere(s), other] }`. Use for any decision read that a
 * member could trigger (list, search, ask, share-within-app), and - with an
 * `id` added - for every by-id lookup before reading or writing anything that
 * belongs to a decision:
 *
 *   prisma.decision.findFirst({ where: { id, ...decisionVisibilityWhere(s) } })
 *
 * A null result becomes a 404, so a hidden decision's existence isn't confirmed.
 */
export function decisionVisibilityWhere(session: TenantSession) {
  return { workspaceId: session.workspaceId, ...decisionAccessWhere(session) };
}

/**
 * Guard a fetched row belongs to the caller's workspace. Returns the row when it
 * matches, otherwise null - callers translate null into 404/403. Prevents acting
 * on an id from another tenant even if a query was under-scoped.
 */
export function sameWorkspace<T extends { workspaceId: string }>(
  row: T | null | undefined,
  session: TenantSession,
): T | null {
  if (!row) return null;
  return row.workspaceId === session.workspaceId ? row : null;
}

/**
 * Action items the caller may see: unattached ones, and ones attached to a
 * decision they can see. Without this, the board would show the titles of
 * private / audience-restricted decisions next to their follow-ups.
 */
export function actionItemVisibilityWhere(session: TenantSession) {
  return {
    workspaceId: session.workspaceId,
    OR: [
      { decisionId: null },
      { decision: decisionAccessWhere(session) },
    ],
  };
}
