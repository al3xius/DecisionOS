import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { exportLimiter, mutationKey } from "@/lib/rate-limit";
import { decisionToMarkdown, exportFileSlug } from "@/lib/decision-export";

/**
 * Download one decision as an ADR-style Markdown file.
 *
 * The point is that a decision record should be able to live next to the code it
 * governs: this hands back a file that drops straight into a `docs/adr`
 * directory, front matter included, with a link back to the live record.
 */
export const GET = withApi<undefined, { id: string }>(
  { require: "auth" },
  async ({ session, params, req }) => {
    const limit = await exportLimiter.check(mutationKey(session));
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many exports. Please wait a moment." },
        { status: 429, headers: limit.headers },
      );
    }

    // Same visibility rule as list and search: private and audience-restricted
    // decisions resolve only for those allowed to see them.
    const decision = await prisma.decision.findFirst({
        where: { id: params.id, ...decisionVisibilityWhere(session) },
        include: {
          owner: { select: { name: true } },
          createdBy: { select: { name: true } },
          tags: { include: { tag: { select: { name: true } } } },
          links: { select: { label: true, url: true, linkType: true } },
          reviews: {
            orderBy: { createdAt: "desc" },
            include: { reviewedBy: { select: { name: true } } },
          },
        },
      });
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const markdown = decisionToMarkdown(decision, { baseUrl });
    const filename = `${exportFileSlug(decision.title)}.md`;

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
