DROP POLICY IF EXISTS "demo full access brand_rules" ON public.brand_rules;
DROP POLICY IF EXISTS "demo full access approved_facts" ON public.approved_facts;
DROP POLICY IF EXISTS "demo full access terminology" ON public.terminology;
DROP POLICY IF EXISTS "demo full access submissions" ON public.submissions;
DROP POLICY IF EXISTS "demo full access findings" ON public.findings;
DROP POLICY IF EXISTS "demo full access comments" ON public.comments;
DROP POLICY IF EXISTS "demo full access audit_log" ON public.audit_log;

REVOKE ALL ON public.brand_rules, public.approved_facts, public.terminology, public.submissions,
  public.findings, public.comments, public.audit_log FROM anon, authenticated;
GRANT ALL ON public.brand_rules, public.approved_facts, public.terminology, public.submissions,
  public.findings, public.comments, public.audit_log TO service_role;

DROP POLICY IF EXISTS "demo upload submission images" ON storage.objects;
DROP POLICY IF EXISTS "demo read submission images" ON storage.objects;