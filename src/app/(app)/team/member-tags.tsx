"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Text } from "@/components/ui/text";
import { sendJson } from "@/lib/client-fetch";

interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

const DEFAULT_COLOR = "#6366f1";

function chipStyle(color: string | null) {
  const c = color ?? DEFAULT_COLOR;
  return { backgroundColor: `${c}18`, borderColor: `${c}40`, color: c };
}

/**
 * Tags held by one member. A decision restricted to tags is visible only to its
 * author and to members holding at least one of them. Admins edit; others read.
 */
export function MemberTags({
  membershipId,
  name,
  applied,
  available,
  readOnly,
}: {
  membershipId: string;
  name: string;
  applied: TagOption[];
  available: TagOption[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [tags, setTags] = useState(applied);
  const [prevApplied, setPrevApplied] = useState(applied);
  if (applied !== prevApplied) {
    setPrevApplied(applied);
    setTags(applied);
  }

  const appliedIds = new Set(tags.map((t) => t.id));
  const addable = available.filter((t) => !appliedIds.has(t.id));

  function save(next: TagOption[]) {
    const before = tags;
    setTags(next);
    startTransition(async () => {
      const err = await sendJson(`/api/team/${membershipId}/tags`, "PUT", {
        tagIds: next.map((t) => t.id),
      });
      if (err) {
        setTags(before);
        toast.error(`Could not update ${name}'s tags: ${err}`);
      } else {
        router.refresh();
      }
    });
  }

  if (readOnly && tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex h-6 items-center gap-1 rounded-full border pl-2 pr-1"
          style={chipStyle(t.color)}
        >
          <Text as="span" size="xs" color="inherit">{t.name}</Text>
          {!readOnly && (
            <button
              type="button"
              onClick={() => save(tags.filter((x) => x.id !== t.id))}
              disabled={pending}
              aria-label={`Remove tag ${t.name} from ${name}`}
              className="rounded-full p-0.5 opacity-70 hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && addable.length > 0 && (
        <select
          aria-label={`Add tag to ${name}`}
          value=""
          disabled={pending}
          onChange={(e) => {
            const tag = addable.find((t) => t.id === e.target.value);
            if (tag) save([...tags, tag]);
          }}
          className="h-6 rounded-xs bg-white px-1.5 text-xs text-text-secondary shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">+ Tag…</option>
          {addable.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
