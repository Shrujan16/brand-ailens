/**
 * All BrandLens data access goes through these server functions. Browsers have no direct
 * table or storage access (RLS denies anon/authenticated); each function validates its input
 * and performs only the narrow operation the app needs.
 *
 * There is no sign-in. Each browser gets a private workspace: a random secret in an
 * HttpOnly cookie, stored only as a SHA-256 hash on the submissions it owns. Submissions,
 * findings, comments, decisions and uploaded images are scoped to that workspace; rows
 * marked is_sample are read-only examples every visitor can view.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const WS_COOKIE = "bl_ws";
const WS_TOKEN = /^[A-Za-z0-9_-]{43}$/;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns the caller's workspace hash from the private cookie. With create=true a missing
 * or malformed cookie is replaced by a fresh random one (only writes create workspaces).
 */
async function workspace(create: true): Promise<string>;
async function workspace(create: false): Promise<string | null>;
async function workspace(create: boolean): Promise<string | null> {
  const { getCookie, setCookie } = await import("@tanstack/react-start/server");
  let token = getCookie(WS_COOKIE);
  if (!token || !WS_TOKEN.test(token)) {
    if (!create) return null;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    setCookie(WS_COOKIE, token, {
      httpOnly: true,
      secure: true,
      // The editor preview runs in a cross-site frame; Partitioned keeps the cookie per top-level site.
      sameSite: "none",
      partitioned: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return sha256Hex(token);
}

/** PostgREST filter for submissions the caller may read: examples plus their own. */
function visibleFilter(ws: string | null) {
  return ws ? `is_sample.eq.true,workspace_hash.eq.${ws}` : "is_sample.eq.true";
}

type SubmissionRow = { workspace_hash: string | null; is_sample: boolean };
/** Strip the owner hash before returning a submission to the browser. */
function publicSubmission<T extends SubmissionRow>(row: T) {
  const { workspace_hash: _owner, ...rest } = row;
  return rest;
}

/** Loads a submission the caller owns (examples are read-only), or throws. */
async function ownedSubmission(id: string) {
  const ws = await workspace(false);
  const db = await admin();
  const { data, error } = await db.from("submissions").select("id, status, revision, workspace_hash, is_sample").eq("id", id).maybeSingle();
  if (error) fail("load submission", error);
  if (data?.is_sample) throw new Error("Example submissions are read-only. Submit your own from the Create page to try this.");
  if (!data || !ws || data.workspace_hash !== ws) throw new Error("Submission not found.");
  return { db, sub: data, ws };
}

function fail(context: string, error: unknown): never {
  console.error(`[brandlens] ${context}`, error);
  throw new Error(`Could not ${context}. Please try again.`);
}

/** Parse input, turning validation failures into one readable message. */
function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

const uuid = z.string().uuid();
const role = z.enum(["creator", "reviewer"]);
const severity = z.enum(["high", "medium", "low"]);
const hex = z.string().regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/);
// New uploads live under the owner's workspace hash; older example images have no folder.
const IMAGE_PATH = /^uploads\/(?:[0-9a-f]{64}\/)?[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/;
// Storage path for uploads, or a bundled example image served by the app itself.
const imageRef = z
  .string()
  .max(300)
  .refine((v) => IMAGE_PATH.test(v) || /^\/[\w\-./]+\.(jpg|jpeg|png|webp)$/.test(v), "Invalid image");

// ---------- Reads ----------

export const getKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [rules, facts, terms] = await Promise.all([
    db.from("brand_rules").select("*").order("sort").order("created_at"),
    db.from("approved_facts").select("*").order("created_at"),
    db.from("terminology").select("*").order("created_at"),
  ]);
  if (rules.error || facts.error || terms.error) fail("load brand knowledge", rules.error ?? facts.error ?? terms.error);
  return {
    rules: rules.data,
    facts: facts.data.map((f) => ({ ...f, numeric_value: f.numeric_value == null ? null : Number(f.numeric_value) })),
    terms: terms.data,
  };
});

export const listSubmissions = createServerFn({ method: "GET" }).handler(async () => {
  const ws = await workspace(false);
  const db = await admin();
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .or(visibleFilter(ws))
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) fail("load submissions", error);
  return data.map(publicSubmission);
});

export const listAllFindings = createServerFn({ method: "GET" }).handler(async () => {
  const ws = await workspace(false);
  const db = await admin();
  const subs = await db.from("submissions").select("id").or(visibleFilter(ws)).limit(200);
  if (subs.error) fail("load findings", subs.error);
  const ids = subs.data.map((s) => s.id);
  if (!ids.length) return [];
  const { data, error } = await db
    .from("findings")
    .select("id, submission_id, revision, category, severity, status, citation, rule_ref")
    .in("submission_id", ids)
    .limit(5000);
  if (error) fail("load findings", error);
  return data;
});

export const getSubmissionDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => parse(z.object({ id: uuid }), input))
  .handler(async ({ data }) => {
    const ws = await workspace(false);
    const db = await admin();
    const sub = await db.from("submissions").select("*").eq("id", data.id).maybeSingle();
    if (sub.error) fail("load submission", sub.error);
    const visible = !!sub.data && (sub.data.is_sample || (!!ws && sub.data.workspace_hash === ws));
    if (!visible) return { submission: null, readOnly: true, findings: [], comments: [], audit: [] };
    const [findings, comments, audit] = await Promise.all([
      db.from("findings").select("*").eq("submission_id", data.id).order("created_at"),
      db.from("comments").select("*").eq("submission_id", data.id).order("created_at"),
      db.from("audit_log").select("*").eq("submission_id", data.id).order("created_at", { ascending: false }),
    ]);
    const err = findings.error ?? comments.error ?? audit.error;
    if (err) fail("load submission", err);
    return {
      submission: publicSubmission(sub.data!),
      readOnly: sub.data!.is_sample,
      findings: findings.data ?? [],
      comments: comments.data ?? [],
      audit: (audit.data ?? []).map((a) => ({ ...a, details: (a.details ?? {}) as Record<string, string | number | null> })),
    };
  });

// ---------- Submissions ----------

const findingInput = z
  .object({
    rule_ref: z.string().max(200),
    category: z.string().min(1).max(60),
    severity,
    matched_text: z.string().max(2000),
    citation: z.string().max(600),
    explanation: z.string().max(1200),
    suggestion: z.string().max(2000).nullable(),
    status: z.enum(["open", "accepted", "edited", "dismissed"]),
    dismiss_reason: z.string().trim().max(500).nullable(),
  })
  .refine((f) => f.status !== "dismissed" || !!f.dismiss_reason, "A dismissed finding needs a reason");

const saveInput = z.object({
  editId: uuid.nullable(),
  role,
  status: z.enum(["draft", "in_review"]),
  title: z.string().trim().max(200),
  content_type: z.enum(["Social post", "Ad", "Email", "Document"]),
  body: z.string().min(1).max(20000),
  image_url: imageRef.nullable(),
  image_alt: z.string().max(500),
  text_color: hex.nullable(),
  bg_color: hex.nullable(),
  findings: z.array(findingInput).max(300),
});

export const saveSubmission = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => parse(saveInput, input))
  .handler(async ({ data }) => {
    const ws = await workspace(true);
    if (data.image_url?.startsWith("uploads/") && !data.image_url.startsWith(`uploads/${ws}/`))
      throw new Error("Please upload the image again.");
    const db = await admin();
    const base = {
      title: data.title || "Untitled",
      content_type: data.content_type,
      body: data.body,
      image_url: data.image_url,
      image_alt: data.image_alt,
      text_color: data.text_color,
      bg_color: data.bg_color,
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    let id: string;
    let revision = 1;
    let action = data.status === "draft" ? "draft_saved" : "submitted";

    if (data.editId) {
      const { sub: existing } = await ownedSubmission(data.editId);
      if (existing.status === "in_review") throw new Error("This submission is already in review.");
      id = existing.id;
      revision =
        existing.status === "changes_requested" || existing.status === "approved"
          ? existing.revision + 1
          : existing.revision;
      if (revision > existing.revision && data.status === "in_review") action = "resubmitted";
      const upd = await db.from("submissions").update({ ...base, revision }).eq("id", id);
      if (upd.error) fail("save submission", upd.error);
      const del = await db.from("findings").delete().eq("submission_id", id).eq("revision", revision);
      if (del.error) fail("save submission", del.error);
    } else {
      const ins = await db
        .from("submissions")
        .insert({ ...base, revision, author_name: "Creator", workspace_hash: ws, is_sample: false })
        .select("id")
        .single();
      if (ins.error) fail("save submission", ins.error);
      id = ins.data.id;
    }

    if (data.findings.length) {
      const rows = data.findings.map((f) => ({ ...f, submission_id: id, revision }));
      const ins = await db.from("findings").insert(rows);
      if (ins.error) fail("save findings", ins.error);
    }
    const open = data.findings.filter((f) => f.status === "open").length;
    const log = await db.from("audit_log").insert({
      submission_id: id,
      actor_role: data.role,
      action,
      details: { revision, body: data.body, open_findings: open, resolved: data.findings.length - open },
    });
    if (log.error) fail("record history", log.error);
    return { id, revision, open };
  });

export const addComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    parse(z.object({ submissionId: uuid, role, body: z.string().trim().min(1).max(2000) }), input),
  )
  .handler(async ({ data }) => {
    const { db, sub } = await ownedSubmission(data.submissionId);
    const ins = await db.from("comments").insert({ submission_id: sub.id, author_role: data.role, body: data.body });
    if (ins.error) fail("post comment", ins.error);
    await db.from("audit_log").insert({
      submission_id: sub.id,
      actor_role: data.role,
      action: "commented",
      details: { revision: sub.revision },
    });
    return { ok: true };
  });

export const decideSubmission = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    parse(
      z
      .object({
        submissionId: uuid,
        role,
        decision: z.enum(["approved", "changes_requested"]),
        comment: z.string().trim().max(2000),
      })
      .refine((d) => d.role === "reviewer", "Only a Reviewer can approve or request changes.")
      .refine((d) => d.decision !== "changes_requested" || d.comment.length > 0, "Add a comment explaining what to change."),
      input,
    ),
  )
  .handler(async ({ data }) => {
    const { db, sub } = await ownedSubmission(data.submissionId);
    if (sub.status === "draft") throw new Error("Drafts must be submitted before review.");
    if (data.comment) {
      const c = await db.from("comments").insert({ submission_id: data.submissionId, author_role: "reviewer", body: data.comment });
      if (c.error) fail("post comment", c.error);
    }
    const upd = await db
      .from("submissions")
      .update({ status: data.decision, updated_at: new Date().toISOString() })
      .eq("id", data.submissionId);
    if (upd.error) fail("update submission", upd.error);
    await db.from("audit_log").insert({
      submission_id: data.submissionId,
      actor_role: "reviewer",
      action: data.decision,
      details: { revision: sub.revision, ...(data.comment ? { comment: data.comment } : {}) },
    });
    return { ok: true };
  });

// ---------- Brand knowledge ----------

const ruleValues = z.object({
  kind: z.enum(["tone", "banned_phrase", "superlative", "visual_palette", "visual_contrast", "alt_text", "readability"]),
  label: z.string().trim().min(1).max(200),
  value: z.string().max(500),
  suggestion: z.string().max(500),
  description: z.string().max(1000),
  severity,
});
const factValues = z.object({
  fact_key: z.string().trim().regex(/^[a-z0-9_]{1,60}$/, "Key must be lowercase letters, numbers or _"),
  label: z.string().trim().min(1).max(200),
  statement: z.string().trim().min(1).max(1000),
  fact_type: z.enum(["price", "year", "days", "text"]),
  numeric_value: z.number().finite().nullable(),
  context_terms: z.array(z.string().trim().min(1).max(60)).max(20),
});
const termValues = z.object({
  preferred: z.string().trim().min(1).max(200),
  rule_type: z.enum(["replace", "requires"]),
  incorrect: z.array(z.string().trim().min(1).max(100)).max(30),
  requires_phrase: z.string().max(200),
  note: z.string().max(1000),
  severity,
});
const KNOWLEDGE_SCHEMAS = { brand_rules: ruleValues, approved_facts: factValues, terminology: termValues } as const;

export const mutateKnowledge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const baseSchema = z
      .object({
        table: z.enum(["brand_rules", "approved_facts", "terminology"]),
        op: z.enum(["insert", "update", "delete"]),
        id: uuid.optional(),
        role,
        values: z.record(z.unknown()).optional(),
      })
      .refine((d) => d.op === "insert" || !!d.id, "Missing id");
    const base = parse(baseSchema, input);
    const values = base.op === "delete" ? null : parse(KNOWLEDGE_SCHEMAS[base.table], base.values ?? {});
    return { ...base, values };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const q = db.from(data.table);
    const res =
      data.op === "insert"
        ? await q.insert(data.values as never)
        : data.op === "update"
          ? await q.update(data.values as never).eq("id", data.id!)
          : await q.delete().eq("id", data.id!);
    if (res.error) fail("save brand knowledge", res.error);
    await db.from("audit_log").insert({
      submission_id: null,
      actor_role: data.role,
      action: `knowledge_${data.op}`,
      details: { table: data.table, id: data.id ?? null, ...(data.values ?? {}) },
    });
    return { ok: true };
  });

// ---------- Images ----------

const IMAGE_BUCKET = "submission-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const uploadSubmissionImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Expected form data");
    const file = input.get("file");
    if (!(file instanceof File)) throw new Error("No file uploaded");
    if (!IMAGE_TYPES[file.type]) throw new Error("Please upload a JPG, PNG, WebP or GIF image.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");
    return { file };
  })
  .handler(async ({ data }) => {
    const ws = await workspace(true);
    const db = await admin();
    const path = `uploads/${ws}/${crypto.randomUUID()}.${IMAGE_TYPES[data.file.type]}`;
    const { error } = await db.storage
      .from(IMAGE_BUCKET)
      .upload(path, await data.file.arrayBuffer(), { contentType: data.file.type, upsert: false });
    if (error) fail("upload image", error);
    return { path };
  });

export const getImageUrl = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => parse(z.object({ path: z.string().regex(IMAGE_PATH) }), input))
  .handler(async ({ data }) => {
    const ws = await workspace(false);
    const db = await admin();
    const own = !!ws && data.path.startsWith(`uploads/${ws}/`);
    if (!own) {
      // Otherwise only images attached to an example submission may be shown.
      const ex = await db.from("submissions").select("id").eq("is_sample", true).eq("image_url", data.path).limit(1);
      if (ex.error || !ex.data.length) return { url: null };
    }
    const { data: signed, error } = await db.storage.from(IMAGE_BUCKET).createSignedUrl(data.path, 60 * 60);
    if (error) return { url: null };
    return { url: signed.signedUrl };
  });
