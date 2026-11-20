import { queryOptions } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import type { Knowledge } from "@/lib/brand-engine";
import {
  getImageUrl,
  getKnowledge,
  getSubmissionDetail,
  listAllFindings,
  listSubmissions,
  uploadSubmissionImage,
} from "@/lib/brandlens.functions";

/** Submissions as returned to the browser (the private owner hash is stripped server-side). */
export type Submission = Omit<Tables<"submissions">, "workspace_hash">;
export type FindingRow = Tables<"findings">;
export type CommentRow = Tables<"comments">;
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

export const knowledgeQuery = queryOptions({
  queryKey: ["knowledge"],
  queryFn: async () => {
    const k = await getKnowledge();
    const knowledge: Knowledge = k;
    return { ...k, ...knowledge };
  },
});

export const submissionsQuery = queryOptions({
  queryKey: ["submissions"],
  queryFn: () => listSubmissions(),
});

export const allFindingsQuery = queryOptions({
  queryKey: ["findings", "all"],
  queryFn: () => listAllFindings(),
});

export const submissionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["submission", id],
    queryFn: () => getSubmissionDetail({ data: { id } }),
  });

/** Uploads an image to private storage and returns its storage path. */
export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { path } = await uploadSubmissionImage({ data: form });
  return path;
}

/** Resolves a stored image reference into a displayable URL. */
export async function resolveImageUrl(ref: string | null | undefined) {
  if (!ref) return null;
  if (/^(https?:|data:|blob:|\/)/.test(ref)) return ref;
  const { url } = await getImageUrl({ data: { path: ref } });
  return url;
}
