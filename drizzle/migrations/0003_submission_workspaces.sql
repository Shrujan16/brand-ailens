ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS workspace_hash text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
UPDATE public.submissions SET is_sample = true WHERE workspace_hash IS NULL;
CREATE INDEX IF NOT EXISTS submissions_workspace_hash_idx ON public.submissions (workspace_hash);
CREATE INDEX IF NOT EXISTS submissions_is_sample_idx ON public.submissions (is_sample) WHERE is_sample;
COMMENT ON COLUMN public.submissions.workspace_hash IS 'SHA-256 of the private per-browser workspace cookie that owns this submission';
COMMENT ON COLUMN public.submissions.is_sample IS 'Read-only example shown to every visitor';