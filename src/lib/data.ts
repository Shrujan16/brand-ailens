import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Knowledge } from "@/lib/brand-engine";

export type Submission = Tables<"submissions">;
export type FindingRow = Tables<"findings">;
export type CommentRow = Tables<"comments">;
export type AuditRow = Tables<"audit_log">;
export type RuleRow = Tables<"brand_rules">;
export type FactRow = Tables<"approved_facts">;
export type TermRow = Tables<"terminology">;

export type Status = "draft" | "in_review" | "changes_requested" | "approved";
export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
export const CONTENT_TYPES = ["Social post", "Ad", "Email", "Document"] as const;

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const knowledgeQuery = queryOptions({
  queryKey: ["knowledge"],
  queryFn: async () => {
    const [rules, facts, terms] = await Promise.all([
      supabase.from("brand_rules").select("*").order("sort").order("created_at"),
      supabase.from("approved_facts").select("*").order("created_at"),
      supabase.from("terminology").select("*").order("created_at"),
    ]);
    const knowledge: Knowledge = {
      rules: must(rules),
      facts: must(facts).map((f) => ({
        ...f,
        numeric_value: f.numeric_value == null ? null : Number(f.numeric_value),
      })),
      terms: must(terms),
    };
    return knowledge;
  },
});


export const submissionsQuery = queryOptions({
  queryKey: ["submissions"],
  queryFn: async () =>
    must(await supabase.from("submissions").select("*").order("updated_at", { ascending: false })),
});

export const allFindingsQuery = queryOptions({
  queryKey: ["findings", "all"],
  queryFn: async () =>
    must(
      await supabase
        .from("findings")
        .select("id, submission_id, revision, category, severity, status, citation, rule_ref"),
    ),
});

export const submissionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["submission", id],
    queryFn: async () => {
      const [sub, findings, comments, audit] = await Promise.all([
        supabase.from("submissions").select("*").eq("id", id).maybeSingle(),
        supabase.from("findings").select("*").eq("submission_id", id).order("created_at"),
        supabase.from("comments").select("*").eq("submission_id", id).order("created_at"),
        supabase
          .from("audit_log")
          .select("*")
          .eq("submission_id", id)
          .order("created_at", { ascending: false }),
      ]);
      return {
        submission: must(sub),
        findings: must(findings),
        comments: must(comments),
        audit: must(audit),
      };
    },
  });

export async function logAudit(
  submissionId: string | null,
  actorRole: string,
  action: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("audit_log").insert({
    submission_id: submissionId,
    actor_role: actorRole,
    action,
    details: details as never,
  });
  if (error) throw new Error(error.message);
}

const IMAGE_BUCKET = "submission-images";

/** Uploads an image to private storage and returns its storage path. */
export async function uploadImage(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `uploads/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Resolves a stored image reference into a displayable URL. */
export async function resolveImageUrl(ref: string | null | undefined) {
  if (!ref) return null;
  if (/^(https?:|data:|blob:|\/)/.test(ref)) return ref;
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(ref, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
