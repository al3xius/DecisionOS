"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Text } from "@/components/ui/text";
import { AlertCircle, Plus } from "lucide-react";

export function CreateTagForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const router = useRouter();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Tag name is required."); return; }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setName("");
        setColor("#6366f1");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-end gap-3 flex-wrap">
      {error && (
        <div className="w-full flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 text-text-danger" />
          <Text>{error}</Text>
        </div>
      )}
      <Input
        label="Tag name"
        fieldClassName="space-y-1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. security, performance"
        className="h-8 w-48"
      />
      <div className="space-y-1">
        <Text as="span" size="sm" color="secondary" weight="medium" leading="none" className="block">
          Color
        </Text>
        <ColorPicker value={color} onChange={setColor} label="Tag color" disabled={pending} />
      </div>
      <Button size="sm" disabled={pending} onClick={handleCreate}>
        <Plus className="h-3.5 w-3.5" />
        {pending ? "Creating…" : "Create Tag"}
      </Button>
    </div>
  );
}
