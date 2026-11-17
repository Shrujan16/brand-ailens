<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (BrandLens)

- Brand checks run in `src/lib/brand-engine.ts` as pure deterministic TypeScript (no AI); every rule reads its data from the brand_rules / approved_facts / terminology tables so editing Brand Knowledge changes checks without code changes. Cover rule changes in `src/test/brand-engine.test.ts`.
- The app has no sign-in by design (demo for judges). Browsers have no direct table or storage access (no anon/authenticated grants or policies); all reads and writes go through validated server functions in `src/lib/brandlens.functions.ts` using the service-role client. Add new data operations there, never as client policies. The Creator/Reviewer role is still a client-side switch in `src/lib/role.tsx`, so add real auth before using with private data.
- Submission images live in the private `submission-images` bucket; uploads and signed URLs are created server-side (`uploadSubmissionImage`, `getImageUrl`) because public buckets are blocked and clients have no storage policies.
- Findings are stored per submission revision; revision history is the audit_log rows (submitted entries carry a body snapshot).
