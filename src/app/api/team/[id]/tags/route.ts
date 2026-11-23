import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { auditApiEvent } from "@/lib/audit-log";
import { MemberTagsSchema, type MemberTagsInput } from "@/lib/schemas";

/**
 * PUT /api/team/[id]/tags
 * Replace the tags held by a member (by membership id). Admin only. Member tags
 * decide which audience-restricted decisions the member can see, so changes are
 * audit-logged. Tenant-scoped: a foreign membership or tag id is a 404.
 */
export const PUT = withApi<MemberTagsInput, { id: string }>(
  { require: "admin", schema: MemberTagsSchema },
  async ({ session, params, body, req }) => {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        user: { select: { email: true } },
        tags: { select: { tagId: true } },
      },
    });
    if (!membership || membership.workspaceId !== session.workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const tagIds = [...new Set(body.tagIds)];
    if (tagIds.length > 0) {
      const found = await prisma.tag.count({
        where: { workspaceId: session.workspaceId, id: { in: tagIds } },
      });
      if (found !== tagIds.length) {
        return NextResponse.json({ error: "One or more tags were not found." }, { status: 404 });
      }
    }

    const before = membership.tags.map((t) => t.tagId);
    const beforeSet = new Set(before);
    if (before.length === tagIds.length && tagIds.every((t) => beforeSet.has(t))) {
      return NextResponse.json({ success: "No change." });
    }

    await prisma.$transaction([
      prisma.memberTag.deleteMany({ where: { membershipId: membership.id } }),
      prisma.memberTag.createMany({
        data: tagIds.map((tagId) => ({ membershipId: membership.id, tagId })),
      }),
    ]);

    await auditApiEvent({
      action: "member.tags_changed",
      session,
      req,
      targetType: "user",
      targetId: membership.userId,
      metadata: { targetEmail: membership.user.email, from: before, to: tagIds },
    });

    return NextResponse.json({ success: "Tags updated." });
  },
);
