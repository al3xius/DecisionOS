/**
 * Shared, human-readable labels for the DecisionEvent audit trail. Used by the
 * /activity feed page (server) and its filter bar (client), so it carries no
 * server-only imports.
 */
export const ACTIVITY_EVENT_TYPES = [
  "created",
  "updated",
  "status_changed",
  "reviewed",
  "note_added",
  "note_replied",
  "link_added",
  "archived",
  "superseded",
  "share_enabled",
  "share_revoked",
  "tag_added",
  "tag_removed",
  "audience_changed",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

const LABELS: Record<string, string> = {
  created: "created",
  updated: "edited",
  status_changed: "changed the status of",
  reviewed: "reviewed",
  note_added: "added a note to",
  note_replied: "replied to a note on",
  link_added: "linked a resource to",
  archived: "archived",
  superseded: "superseded",
  share_enabled: "created a public link for",
  share_revoked: "revoked the public link for",
  tag_added: "added a tag to",
  tag_removed: "removed a tag from",
  audience_changed: "changed who can see",
};

/** A verb phrase for a feed line: "<name> <verb> <decision>". */
export function activityEventVerb(eventType: string): string {
  return LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

function parse(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function tagNames(v: unknown): string {
  const names = Array.isArray(v) ? v.filter((n): n is string => typeof n === "string") : [];
  return names.length ? names.map((n) => `"${n}"`).join(", ") : "everyone in the workspace";
}

/**
 * What changed, for events that carry it - e.g. `"finance"` for a tag event, or
 * `"everyone" → "finance", "legal"` for an audience change. Tag names are stored
 * on the event, so the log stays readable after a tag is renamed or deleted.
 */
export function activityEventDetail(
  eventType: string,
  newValueJson: string | null | undefined,
  oldValueJson?: string | null,
): string | null {
  const next = parse(newValueJson);
  switch (eventType) {
    case "status_changed":
      return typeof next?.status === "string" ? `→ ${next.status}` : null;
    case "tag_added":
    case "tag_removed":
      return typeof next?.tagName === "string" ? `"${next.tagName}"` : null;
    case "audience_changed": {
      const prev = parse(oldValueJson);
      if (!next) return null;
      return `${tagNames(prev?.tagNames)} → ${tagNames(next.tagNames)}`;
    }
    default:
      return null;
  }
}

/** Event data for a tag added to / removed from a decision. */
export function tagEventJson(tag: { id: string; name: string }): string {
  return JSON.stringify({ tagId: tag.id, tagName: tag.name });
}

/** Event data for an audience ("visible to") change: the tag names at that time. */
export function audienceEventJson(tags: { name: string }[]): string {
  return JSON.stringify({ tagNames: tags.map((t) => t.name).sort((a, b) => a.localeCompare(b)) });
}

/** A short label for the filter dropdown. */
export function activityEventLabel(eventType: string): string {
  const v = activityEventVerb(eventType);
  return v.charAt(0).toUpperCase() + v.slice(1);
}
