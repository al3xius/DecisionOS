import { authorizeRole } from "../../src/lib/authorize";
import {
  workspaceWhere,
  decisionVisibilityWhere,
  sameWorkspace,
} from "../../src/lib/tenant";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const SESSION = { userId: "u_1", workspaceId: "w_1" };

export const apiFoundationTests = {
  "authorizeRole: 'auth' allows every role incl. viewer": () => {
    for (const role of ["admin", "member", "viewer"]) {
      assert(authorizeRole(role, "auth").ok, `${role} should pass auth`);
    }
  },

  "authorizeRole: 'writer' blocks viewer, allows admin/member": () => {
    assert(authorizeRole("admin", "writer").ok, "admin writes");
    assert(authorizeRole("member", "writer").ok, "member writes");
    const v = authorizeRole("viewer", "writer");
    assert(!v.ok && v.status === 403, "viewer blocked with 403");
  },

  "authorizeRole: 'admin' allows only admin": () => {
    assert(authorizeRole("admin", "admin").ok, "admin passes");
    const m = authorizeRole("member", "admin");
    assert(!m.ok && m.status === 403, "member blocked");
    const v = authorizeRole("viewer", "admin");
    assert(!v.ok && v.status === 403, "viewer blocked");
  },

  "workspaceWhere: scopes by the session workspace": () => {
    assert(workspaceWhere(SESSION).workspaceId === "w_1", "workspaceId set");
  },

  "decisionVisibilityWhere: workspace + (own OR unrestricted OR holds an audience tag)": () => {
    const w = decisionVisibilityWhere(SESSION);
    assert(w.workspaceId === "w_1", "workspace scoped");
    assert(Array.isArray(w.OR) && w.OR.length === 3, "three visibility branches");
    const [own, open, tagged] = w.OR as Record<string, unknown>[];
    assert(own.createdByUserId === "u_1", "author always sees their decision");
    assert(open.visibility === "workspace", "open branch requires workspace visibility");
    assert(JSON.stringify(open.audienceTags) === JSON.stringify({ none: {} }), "open branch requires no audience tags");
    assert(tagged.visibility === "workspace", "tag branch requires workspace visibility");
    const json = JSON.stringify(tagged.audienceTags);
    assert(json.includes('"userId":"u_1"') && json.includes('"workspaceId":"w_1"'), "tag branch matches the caller's membership tags");
  },

  "sameWorkspace: returns the row only on a workspace match": () => {
    const mine = { id: "d1", workspaceId: "w_1" };
    const theirs = { id: "d2", workspaceId: "w_2" };
    assert(sameWorkspace(mine, SESSION) === mine, "same workspace → row");
    assert(sameWorkspace(theirs, SESSION) === null, "other workspace → null");
    assert(sameWorkspace(null, SESSION) === null, "null row → null");
  },
};
