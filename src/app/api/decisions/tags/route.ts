import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere, sameWorkspace } from "@/lib/tenant";
import { DecisionTagSchema, type DecisionTagInput } from "@/lib/schemas";
import { tagEventJson } from "@/lib/activity-events";

export const POST = withApi<DecisionTagInput>(
  { require: "writer", schema: DecisionTagSchema },
  async ({ session, body }) => {
    const { decisionId, tagId } = body;
    const [decision, tag] = await Promise.all([
      prisma.decision.findFirst({ where: { id: decisionId, ...decisionVisibilityWhere(session) } }),
      prisma.tag.findUnique({ where: { id: tagId } }),
    ]);
    if (!decision)
      return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    if (!sameWorkspace(tag, session))
      return NextResponse.json({ error: "Tag not found." }, { status: 404 });

    // Only a real change is logged: re-adding an applied tag is a no-op.
    const existing = await prisma.decisionTag.findUnique({
      where: { decisionId_tagId: { decisionId, tagId } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ success: true });

    await prisma.$transaction([
      prisma.decisionTag.create({ data: { decisionId, tagId } }),
      prisma.decisionEvent.create({
        data: { decisionId, userId: session.userId, eventType: "tag_added", newValueJson: tagEventJson(tag!) },
      }),
    ]);

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApi<DecisionTagInput>(
  { require: "writer", schema: DecisionTagSchema },
  async ({ session, body }) => {
    const { decisionId, tagId } = body;
    const decision = await prisma.decision.findFirst({ where: { id: decisionId, ...decisionVisibilityWhere(session) } });
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    const applied = await prisma.decisionTag.findUnique({
      where: { decisionId_tagId: { decisionId, tagId } },
      select: { tag: { select: { id: true, name: true } } },
    });
    if (!applied) return NextResponse.json({ success: true });

    await prisma.$transaction([
      prisma.decisionTag.deleteMany({ where: { decisionId, tagId } }),
      prisma.decisionEvent.create({
        data: {
          decisionId,
          userId: session.userId,
          eventType: "tag_removed",
          newValueJson: tagEventJson(applied.tag),
        },
      }),
    ]);
    return NextResponse.json({ success: true });
  },
);
