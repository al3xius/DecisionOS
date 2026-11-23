/**
 * Integration tests for tag-based decision visibility ("Visible to"):
 * a decision with audience tags is visible only to its author and to members
 * holding at least one of those tags - everywhere a decision can be read.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const holder = vi.hoisted(() => ({
  session: null as null | {
    userId: string;
    workspaceId: string;
    role: string;
    email: string;
    name: string;
    expiresAt: Date;
  },
}));
vi.mock("@/lib/session", () => ({
  getSession: async () => holder.session,
  createSession: async () => {},
  deleteSession: async () => {},
  encrypt: async () => "",
  decrypt: async () => null,
}));

import { prisma } from "@/lib/prisma";
import { GET as searchGET } from "@/app/api/decisions/search/route";
import { POST as decisionsPOST } from "@/app/api/decisions/route";
import { PUT as decisionsPUT } from "@/app/api/decisions/[id]/route";
import { POST as notesPOST } from "@/app/api/decisions/notes/route";
import { GET as versionsGET } from "@/app/api/decisions/[id]/versions/route";
import { GET as markdownGET } from "@/app/api/decisions/[id]/markdown/route";
import { POST as sharePOST } from "@/app/api/decisions/[id]/share/route";
import { POST as bulkPOST } from "@/app/api/decisions/bulk/route";
import { PUT as memberTagsPUT } from "@/app/api/team/[id]/tags/route";
import { DELETE as tagsDELETE, PATCH as tagsPATCH, POST as tagsPOST } from "@/app/api/tags/route";
import { usersWhoCanSeeDecision } from "@/lib/decision-audience";
import RisksPage from "@/app/(app)/risks/page";
import { POST as decisionTagPOST, DELETE as decisionTagDELETE } from "@/app/api/decisions/tags/route";
import { __resetAccessCache } from "@/lib/access-control";

const MARK = `aud${Date.now()}`;

type Ctx = {
  ws: string;
  wsOther: string;
  author: string;
  finance: string; // holds the "finance" tag
  outsider: string; // holds no tags
  admin: string; // workspace admin, no tags
  financeMembership: string;
  outsiderMembership: string;
  tagFinance: string;
  tagLegal: string;
  tagOther: string; // tag from another workspace
  restricted: string;
  open: string;
  userIds: string[];
};
const ctx = {} as Ctx;

function sessionFor(userId: string, role = "member") {
  __resetAccessCache();
  holder.session = {
    userId,
    workspaceId: ctx.ws,
    role,
    email: `${userId}@t.test`,
    name: userId,
    expiresAt: new Date(Date.now() + 6e5),
  };
}

function req(method: string, body?: unknown, url = "http://localhost/x") {
  return new NextRequest(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}
const seg = <T>(params: T) => ({ params: Promise.resolve(params) });

async function search(): Promise<string[]> {
  const res = await searchGET(new NextRequest(`http://localhost/api/decisions/search?q=${MARK}`));
  const json = (await res.json()) as { decisions: { id: string }[] };
  return json.decisions.map((d) => d.id);
}

beforeAll(async () => {
  const ws = await prisma.workspace.create({ data: { name: "Aud", slug: `aud-${MARK}` } });
  const wsOther = await prisma.workspace.create({ data: { name: "Other", slug: `audo-${MARK}` } });
  const mk = (n: string) =>
    prisma.user.create({ data: { name: n, email: `${n}-${MARK}@t.test`, passwordHash: "x" } });
  const [author, finance, outsider, admin] = await Promise.all([
    mk("author"),
    mk("finance"),
    mk("outsider"),
    mk("admin"),
  ]);
  await prisma.workspaceMembership.createMany({
    data: [
      { workspaceId: ws.id, userId: author.id, role: "member" },
      { workspaceId: ws.id, userId: finance.id, role: "member" },
      { workspaceId: ws.id, userId: outsider.id, role: "member" },
      { workspaceId: ws.id, userId: admin.id, role: "admin" },
    ],
  });
  const memberships = await prisma.workspaceMembership.findMany({ where: { workspaceId: ws.id } });
  const mOf = (uid: string) => memberships.find((m) => m.userId === uid)!.id;

  const tagFinance = await prisma.tag.create({ data: { workspaceId: ws.id, name: "finance" } });
  const tagLegal = await prisma.tag.create({ data: { workspaceId: ws.id, name: "legal" } });
  const tagOther = await prisma.tag.create({ data: { workspaceId: wsOther.id, name: "finance" } });

  await prisma.memberTag.create({ data: { membershipId: mOf(finance.id), tagId: tagFinance.id } });

  const restricted = await prisma.decision.create({
    data: {
      workspaceId: ws.id,
      createdByUserId: author.id,
      title: `${MARK} restricted budget cut`,
      status: "approved",
      risks: `${MARK}-hidden-risk layoffs may leak`,
      audienceTags: { create: [{ tagId: tagFinance.id }, { tagId: tagLegal.id }] },
    },
  });
  const open = await prisma.decision.create({
    data: {
      workspaceId: ws.id,
      createdByUserId: author.id,
      title: `${MARK} open roadmap`,
      status: "approved",
      risks: `${MARK}-open-risk vendor delay`,
    },
  });

  Object.assign(ctx, {
    ws: ws.id,
    wsOther: wsOther.id,
    author: author.id,
    finance: finance.id,
    outsider: outsider.id,
    admin: admin.id,
    financeMembership: mOf(finance.id),
    outsiderMembership: mOf(outsider.id),
    tagFinance: tagFinance.id,
    tagLegal: tagLegal.id,
    tagOther: tagOther.id,
    restricted: restricted.id,
    open: open.id,
    userIds: [author.id, finance.id, outsider.id, admin.id],
  });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [ctx.ws, ctx.wsOther] } } });
  await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
});

describe("reads honor audience tags", () => {
  it("a member holding one of the tags sees the restricted decision", async () => {
    sessionFor(ctx.finance);
    const ids = await search();
    expect(ids).toContain(ctx.restricted);
    expect(ids).toContain(ctx.open);
  });

  it("a member without any of the tags does not see it", async () => {
    sessionFor(ctx.outsider);
    const ids = await search();
    expect(ids).not.toContain(ctx.restricted);
    expect(ids).toContain(ctx.open);
  });

  it("a workspace admin without the tags does not see it either", async () => {
    sessionFor(ctx.admin, "admin");
    expect(await search()).not.toContain(ctx.restricted);
  });

  it("the author always sees it", async () => {
    sessionFor(ctx.author);
    expect(await search()).toContain(ctx.restricted);
  });

  it("by-id routes 404 for a member without the tags", async () => {
    sessionFor(ctx.outsider);
    expect((await versionsGET(req("GET"), seg({ id: ctx.restricted }))).status).toBe(404);
    expect((await markdownGET(req("GET"), seg({ id: ctx.restricted }))).status).toBe(404);
    expect((await notesPOST(req("POST", { decisionId: ctx.restricted, content: "peek" }))).status).toBe(404);
    expect(
      (await decisionsPUT(req("PUT", { title: "hijacked title" }), seg({ id: ctx.restricted }))).status,
    ).toBe(404);
    expect((await bulkPOST(req("POST", { action: "export", ids: [ctx.restricted] }))).status).toBe(404);
  });

  it("by-id routes work for a member holding a tag", async () => {
    sessionFor(ctx.finance);
    expect((await versionsGET(req("GET"), seg({ id: ctx.restricted }))).status).toBe(200);
    expect((await markdownGET(req("GET"), seg({ id: ctx.restricted }))).status).toBe(200);
  });

  it("risk register: hidden decisions' risks are not shown", async () => {
    // The page is a server component; its rendered element tree carries the
    // risk entries as props, so serializing it is enough to see what it shows.
    const collect = (node: unknown, out: string[], seen = new Set<unknown>()): string[] => {
      if (typeof node === "string") out.push(node);
      else if (node && typeof node === "object" && !seen.has(node)) {
        seen.add(node);
        for (const v of Object.values(node as Record<string, unknown>)) collect(v, out, seen);
      }
      return out;
    };
    const render = async () =>
      collect(await RisksPage({ searchParams: Promise.resolve({}) }), []).join("\n");

    sessionFor(ctx.outsider);
    let html = await render();
    expect(html).toContain(`${MARK}-open-risk`);
    expect(html).not.toContain(`${MARK}-hidden-risk`);

    sessionFor(ctx.finance);
    html = await render();
    expect(html).toContain(`${MARK}-hidden-risk`);
  });

  it("watcher fan-out only includes users who can see the decision", async () => {
    const allowed = await usersWhoCanSeeDecision(ctx.restricted, ctx.userIds);
    expect([...allowed].sort()).toEqual([ctx.author, ctx.finance].sort());
  });
});

describe("writes", () => {
  it("member tags: assigning a tag grants access, removing it revokes access", async () => {
    sessionFor(ctx.admin, "admin");
    let res = await memberTagsPUT(req("PUT", { tagIds: [ctx.tagLegal] }), seg({ id: ctx.outsiderMembership }));
    expect(res.status).toBe(200);
    sessionFor(ctx.outsider);
    expect(await search()).toContain(ctx.restricted);

    sessionFor(ctx.admin, "admin");
    res = await memberTagsPUT(req("PUT", { tagIds: [] }), seg({ id: ctx.outsiderMembership }));
    expect(res.status).toBe(200);
    sessionFor(ctx.outsider);
    expect(await search()).not.toContain(ctx.restricted);
  });

  it("member tags: only admins, and only tags from the same workspace", async () => {
    sessionFor(ctx.finance);
    expect(
      (await memberTagsPUT(req("PUT", { tagIds: [ctx.tagLegal] }), seg({ id: ctx.outsiderMembership }))).status,
    ).toBe(403);
    sessionFor(ctx.admin, "admin");
    expect(
      (await memberTagsPUT(req("PUT", { tagIds: [ctx.tagOther] }), seg({ id: ctx.outsiderMembership }))).status,
    ).toBe(404);
  });

  it("create: a decision can be created restricted to tags", async () => {
    sessionFor(ctx.author);
    const res = await decisionsPOST(
      req("POST", { title: `${MARK} created restricted`, audienceTagIds: [ctx.tagFinance] }),
    );
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    sessionFor(ctx.outsider);
    expect(await search()).not.toContain(id);
    sessionFor(ctx.finance);
    expect(await search()).toContain(id);
  });

  it("create: rejects audience tags from another workspace", async () => {
    sessionFor(ctx.author);
    const res = await decisionsPOST(
      req("POST", { title: `${MARK} cross tenant tag`, audienceTagIds: [ctx.tagOther] }),
    );
    expect(res.status).toBe(400);
  });

  it("update: only the author or an admin may change the audience", async () => {
    sessionFor(ctx.finance);
    const res = await decisionsPUT(req("PUT", { audienceTagIds: [ctx.tagFinance] }), seg({ id: ctx.open }));
    expect(res.status).toBe(403);
  });

  it("update: restricting revokes the public link; clearing reopens to everyone", async () => {
    await prisma.decision.update({ where: { id: ctx.open }, data: { shareToken: `tok-${MARK}` } });
    sessionFor(ctx.author);
    let res = await decisionsPUT(req("PUT", { audienceTagIds: [ctx.tagFinance] }), seg({ id: ctx.open }));
    expect(res.status).toBe(200);
    const row = await prisma.decision.findUnique({ where: { id: ctx.open }, select: { shareToken: true } });
    expect(row?.shareToken).toBeNull();
    sessionFor(ctx.outsider);
    expect(await search()).not.toContain(ctx.open);

    sessionFor(ctx.author);
    res = await decisionsPUT(req("PUT", { audienceTagIds: [] }), seg({ id: ctx.open }));
    expect(res.status).toBe(200);
    sessionFor(ctx.outsider);
    expect(await search()).toContain(ctx.open);
  });

  it("share: a restricted decision can't get a public link", async () => {
    await prisma.workspace.update({ where: { id: ctx.ws }, data: { publicSharing: true } });
    sessionFor(ctx.author);
    const res = (await sharePOST(req("POST"), seg({ id: ctx.restricted }))) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("tags: deleting a tag that restricts a decision is refused", async () => {
    sessionFor(ctx.admin, "admin");
    const res = await tagsDELETE(req("DELETE", { tagId: ctx.tagLegal }));
    expect(res.status).toBe(409);
  });
});

describe("tag colors", () => {
  it("an admin can change a tag's color (normalized to lowercase hex)", async () => {
    sessionFor(ctx.admin, "admin");
    const res = await tagsPATCH(req("PATCH", { tagId: ctx.tagFinance, color: "#12AB9F" }));
    expect(res.status).toBe(200);
    const tag = await prisma.tag.findUnique({ where: { id: ctx.tagFinance }, select: { color: true } });
    expect(tag?.color).toBe("#12ab9f");
  });

  it("rejects non-hex colors on create and update", async () => {
    sessionFor(ctx.admin, "admin");
    expect((await tagsPATCH(req("PATCH", { tagId: ctx.tagFinance, color: "red" }))).status).toBe(400);
    expect((await tagsPOST(req("POST", { name: `${MARK}-bad`, color: "url(x)" }))).status).toBe(400);
  });

  it("only admins, and only tags in their workspace", async () => {
    sessionFor(ctx.finance);
    expect((await tagsPATCH(req("PATCH", { tagId: ctx.tagFinance, color: "#000000" }))).status).toBe(403);
    sessionFor(ctx.admin, "admin");
    expect((await tagsPATCH(req("PATCH", { tagId: ctx.tagOther, color: "#000000" }))).status).toBe(404);
  });
});

describe("activity log for tag changes", () => {
  const events = (decisionId: string, eventType: string) =>
    prisma.decisionEvent.findMany({
      where: { decisionId, eventType },
      select: { userId: true, newValueJson: true, oldValueJson: true },
      orderBy: { createdAt: "asc" },
    });

  it("logs who added and who removed a tag, once per real change", async () => {
    sessionFor(ctx.finance);
    const body = { decisionId: ctx.restricted, tagId: ctx.tagLegal };
    expect((await decisionTagPOST(req("POST", body))).status).toBe(200);
    expect((await decisionTagPOST(req("POST", body))).status).toBe(200); // already applied - no new event

    sessionFor(ctx.author);
    expect((await decisionTagDELETE(req("DELETE", body))).status).toBe(200);
    expect((await decisionTagDELETE(req("DELETE", body))).status).toBe(200); // already gone - no new event

    const added = await events(ctx.restricted, "tag_added");
    const removed = await events(ctx.restricted, "tag_removed");
    expect(added).toHaveLength(1);
    expect(removed).toHaveLength(1);
    expect(added[0].userId).toBe(ctx.finance);
    expect(removed[0].userId).toBe(ctx.author);
    expect(JSON.parse(added[0].newValueJson!)).toMatchObject({ tagId: ctx.tagLegal, tagName: "legal" });
  });

  it("logs audience changes with before/after tag names and no generic 'updated' event", async () => {
    const d = await prisma.decision.create({
      data: { workspaceId: ctx.ws, createdByUserId: ctx.author, title: `${MARK} audience log`, status: "approved" },
    });
    sessionFor(ctx.author);
    const res = await decisionsPUT(req("PUT", { audienceTagIds: [ctx.tagFinance] }), seg({ id: d.id }));
    expect(res.status).toBe(200);

    const changed = await events(d.id, "audience_changed");
    expect(changed).toHaveLength(1);
    expect(changed[0].userId).toBe(ctx.author);
    expect(JSON.parse(changed[0].oldValueJson!)).toEqual({ tagNames: [] });
    expect(JSON.parse(changed[0].newValueJson!)).toEqual({ tagNames: ["finance"] });
    expect(await events(d.id, "updated")).toHaveLength(0);
  });
});
