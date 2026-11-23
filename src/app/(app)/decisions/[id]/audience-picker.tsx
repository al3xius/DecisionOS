"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
 * "Visible to" audience tags. With none applied, the decision is visible to the
 * whole workspace; with one or more, only the author and members holding at
 * least one of the tags can see it. Only the author or an admin may edit.
 */
export function AudiencePicker({
  decisionId,
  applied,
  available,
  readOnly,
}: {
  decisionId: string;
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
    if (
      tags.length === 0 &&
      next.length > 0 &&
      !confirm(
        "Restrict this decision? Only its author and members holding the selected tag(s) will be able to see it, and any public link is revoked.",
      )
    ) {
      return;
    }
    const before = tags;
    setTags(next);
    startTransition(async () => {
      const err = await sendJson(`/api/decisions/${decisionId}`, "PUT", {
        audienceTagIds: next.map((t) => t.id),
      });
      if (err) {
        setTags(before);
        toast.error(`Could not update who can see this: ${err}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {tags.length > 0 ? (
        <>
          <ul className="flex flex-wrap gap-1.5" aria-label="Visible to tags">
            {tags.map((t) => (
              <li
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
                    aria-label={`Remove audience tag ${t.name}`}
                    className="rounded-full p-0.5 opacity-70 hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Text as="p" size="xs" color="subtle">
            Only the author and members with any of these tags can see this decision.
          </Text>
        </>
      ) : (
        <Text as="p" size="xs" color="subtle">Everyone in the workspace.</Text>
      )}

      {!readOnly &&
        (available.length === 0 ? (
          <Text as="p" size="xs" color="subtle">
            <Link href="/tags" className="underline hover:text-text-primary">Create workspace tags</Link> and
            assign them to members on the Team page to restrict who can see a decision.
          </Text>
        ) : (
          addable.length > 0 && (
            <select
              aria-label="Restrict to tag"
              value=""
              disabled={pending}
              onChange={(e) => {
                const tag = addable.find((t) => t.id === e.target.value);
                if (tag) save([...tags, tag]);
              }}
              className="h-7 w-full rounded-xs bg-white px-2 text-xs text-text-secondary shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">+ Restrict to tag…</option>
              {addable.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )
        ))}
    </div>
  );
}
