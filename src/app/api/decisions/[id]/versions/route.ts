import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";

export const GET = withApi<undefined, { id: string }>({ require: "auth" }, async ({ session, params }) => {
  const decision = await prisma.decision.findFirst({ where: { id: params.id, ...decisionVisibilityWhere(session) }, select: { id: true, workspaceId: true, visibility: true, createdByUserId: true } });
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

  const versions = await prisma.decisionVersion.findMany({
    where: { decisionId: params.id },
    orderBy: { versionNum: "desc" },
    include: { changedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ versions });
});
