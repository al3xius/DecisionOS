"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "@/lib/client-fetch";

const DEFAULT_COLOR = "#6366f1";

/**
 * The tag's color dot as a button (admins only): opens a popover with the color
 * picker and a live chip preview. Saves on "Save"; closing discards the draft.
 */
export function EditTagColor({ tagId, name, color }: { tagId: string; name: string; color: string | null }) {
  const current = color ?? DEFAULT_COLOR;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);

  function onOpenChange(next: boolean) {
    if (next) setDraft(current);
    setOpen(next);
  }

  function save() {
    if (draft === current) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const err = await sendJson("/api/tags", "PATCH", { tagId, color: draft });
      if (err) {
        toast.error(`Could not change color: ${err}`);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Change color of tag ${name}`}
          title="Change color"
          className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full ring-offset-1 transition-shadow hover:ring-2 hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{ backgroundColor: current }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-xs border border-slate-200 bg-white p-4 shadow-soft"
        >
          <div className="flex items-center gap-2">
            <Text size="sm" weight="medium">Color for</Text>
            <span
              className="inline-flex h-6 items-center rounded-full border px-2"
              style={{ backgroundColor: `${draft}18`, borderColor: `${draft}40`, color: draft }}
            >
              <Text as="span" size="xs" color="inherit">{name}</Text>
            </span>
          </div>
          <ColorPicker value={draft} onChange={setDraft} label="Tag color" disabled={pending} />
          <div className="flex justify-end gap-2">
            <Popover.Close asChild>
              <Button type="button" variant="ghost" size="sm" disabled={pending}>Cancel</Button>
            </Popover.Close>
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
