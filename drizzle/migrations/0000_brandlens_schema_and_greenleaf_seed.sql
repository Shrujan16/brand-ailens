CREATE TABLE public.brand_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  label text NOT NULL,
  value text NOT NULL DEFAULT '',
  suggestion text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_rules TO anon, authenticated;
GRANT ALL ON public.brand_rules TO service_role;
ALTER TABLE public.brand_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access brand_rules" ON public.brand_rules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.approved_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_key text NOT NULL,
  label text NOT NULL,
  statement text NOT NULL,
  fact_type text NOT NULL DEFAULT 'text',
  numeric_value numeric,
  context_terms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_facts TO anon, authenticated;
GRANT ALL ON public.approved_facts TO service_role;
ALTER TABLE public.approved_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access approved_facts" ON public.approved_facts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.terminology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preferred text NOT NULL,
  incorrect text[] NOT NULL DEFAULT '{}',
  rule_type text NOT NULL DEFAULT 'replace',
  requires_phrase text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminology TO anon, authenticated;
GRANT ALL ON public.terminology TO service_role;
ALTER TABLE public.terminology ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access terminology" ON public.terminology FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled',
  content_type text NOT NULL DEFAULT 'Social post',
  body text NOT NULL DEFAULT '',
  image_url text,
  image_alt text NOT NULL DEFAULT '',
  text_color text,
  bg_color text,
  status text NOT NULL DEFAULT 'draft',
  revision integer NOT NULL DEFAULT 1,
  author_name text NOT NULL DEFAULT 'Creator',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO anon, authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access submissions" ON public.submissions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1,
  rule_ref text NOT NULL DEFAULT '',
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  matched_text text NOT NULL DEFAULT '',
  citation text NOT NULL DEFAULT '',
  explanation text NOT NULL DEFAULT '',
  suggestion text,
  status text NOT NULL DEFAULT 'open',
  dismiss_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO anon, authenticated;
GRANT ALL ON public.findings TO service_role;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access findings" ON public.findings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX findings_submission_idx ON public.findings(submission_id);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  author_role text NOT NULL DEFAULT 'reviewer',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO anon, authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access comments" ON public.comments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX comments_submission_idx ON public.comments(submission_id);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  actor_role text NOT NULL DEFAULT 'creator',
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO anon, authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access audit_log" ON public.audit_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX audit_submission_idx ON public.audit_log(submission_id);

-- Seed: brand rules
INSERT INTO public.brand_rules (kind, label, value, suggestion, description, severity, sort) VALUES
('tone', 'Warm, honest, simple', '', '', 'Write like a friendly neighbour who knows food. Short sentences, plain words, no hype.', 'low', 1),
('banned_phrase', 'No "best in India"', 'best in India', 'loved across India', 'Hype claim we cannot prove.', 'high', 10),
('banned_phrase', 'No "guaranteed"', 'guaranteed', 'thoughtfully made', 'We never promise outcomes.', 'high', 11),
('banned_phrase', 'No "miracle"', 'miracle', 'wholesome', 'Food is not magic. Avoid miracle language.', 'high', 12),
('banned_phrase', 'No "cheapest"', 'cheapest', 'fairly priced', 'We compete on honesty, not price wars.', 'high', 13),
('banned_phrase', 'No "#1"', '#1', 'much-loved', 'Ranking claims need proof we do not have.', 'high', 14),
('superlative', 'Unsupported superlative: healthiest', 'healthiest', 'wholesome', 'Superlatives need evidence.', 'medium', 20),
('superlative', 'Unsupported superlative: tastiest', 'tastiest', 'tasty', 'Superlatives need evidence.', 'medium', 21),
('superlative', 'Unsupported claim: 100% pure', '100% pure', 'certified organic', 'Say what is certified, not absolute purity.', 'medium', 22),
('superlative', 'Unsupported superlative: best', 'best', 'great', 'Superlatives need evidence.', 'medium', 23),
('superlative', 'Unsupported superlative: world-class', 'world-class', 'carefully made', 'Superlatives need evidence.', 'medium', 24),
('superlative', 'Unsupported superlative: unbeatable', 'unbeatable', 'honest', 'Superlatives need evidence.', 'medium', 25),
('visual_palette', 'Brand palette', '#2E7D32, #F9A825, #FFFFFF', '', 'Leaf green, harvest yellow and white.', 'low', 30),
('visual_contrast', 'Text contrast at least 4.5:1', '4.5', '', 'WCAG AA contrast for body text.', 'high', 31),
('alt_text', 'Every image needs alt text', '', 'GreenLeaf Organics product photo', 'Describe what is in the image for screen readers.', 'high', 32),
('readability', 'Keep sentences under 25 words', '25', '', 'Long sentences feel salesy and are hard to read.', 'low', 40),
('readability', 'One exclamation mark at most', '!!', '!', 'Repeated exclamation marks read as hype.', 'low', 41);

-- Seed: approved facts
INSERT INTO public.approved_facts (fact_key, label, statement, fact_type, numeric_value, context_terms) VALUES
('founded_year', 'Founded', 'GreenLeaf Organics was founded in 2019.', 'year', 2019, ARRAY['since','founded','established','started','began']),
('delivery_threshold', 'Free delivery threshold', 'Delivery is free on orders above Rs 799.', 'price', 799, ARRAY['delivery','shipping']),
('almond_crunch_price', 'Almond Crunch price', 'An Almond Crunch pack costs Rs 249.', 'price', 249, ARRAY['almond crunch']),
('organic_certification', 'Organic certification', 'Our products are certified organic by an Indian certification body.', 'text', NULL, ARRAY['certified organic']),
('return_window', 'Returns', 'Returns are accepted within 7 days.', 'days', 7, ARRAY['return','send it back','refund']);

-- Seed: terminology
INSERT INTO public.terminology (preferred, incorrect, rule_type, requires_phrase, note, severity) VALUES
('GreenLeaf Organics', ARRAY['Green Leaf Organics','Greenleaf Organics','Green-Leaf Organics','Green Leaf','Greenleaf','Green-Leaf'], 'replace', '', 'Always one word "GreenLeaf", capital L, followed by "Organics".', 'medium'),
('plant-based', ARRAY['vegan-certified','vegan certified'], 'replace', '', 'We are not vegan-certified. Say "plant-based".', 'high'),
('free delivery', ARRAY[]::text[], 'requires', 'above Rs 799', 'Only say "free delivery" together with "above Rs 799".', 'high');

-- Seed: sample submissions
INSERT INTO public.submissions (id, title, content_type, body, status, revision, author_name, created_at, updated_at) VALUES
('11111111-1111-4111-8111-111111111111', 'Monsoon snack email', 'Email', 'Rainy days call for something crunchy. Our Almond Crunch pack is Rs 249, and delivery is free above Rs 799. Made with care since 2019.', 'approved', 1, 'Asha (Creator)', now() - interval '3 days', now() - interval '2 days'),
('22222222-2222-4222-8222-222222222222', 'Weekend Instagram post', 'Social post', 'Greenleaf snacks are the cheapest and tastiest around!! Free delivery on all orders this weekend.', 'in_review', 1, 'Rahul (Creator)', now() - interval '1 day', now() - interval '1 day');

INSERT INTO public.findings (submission_id, revision, rule_ref, category, severity, matched_text, citation, explanation, suggestion, status, dismiss_reason) VALUES
('22222222-2222-4222-8222-222222222222', 1, 'term:GreenLeaf Organics', 'Terminology', 'medium', 'Greenleaf', 'Terminology: GreenLeaf Organics', 'Brand name must be written "GreenLeaf Organics".', 'GreenLeaf Organics', 'open', NULL),
('22222222-2222-4222-8222-222222222222', 1, 'banned:cheapest', 'Banned word', 'high', 'cheapest', 'Brand rule: No "cheapest"', 'We compete on honesty, not price wars.', 'fairly priced', 'open', NULL),
('22222222-2222-4222-8222-222222222222', 1, 'superlative:tastiest', 'Unsupported claim', 'medium', 'tastiest', 'Brand rule: Unsupported superlative: tastiest', 'Superlatives need evidence.', 'tasty', 'open', NULL),
('22222222-2222-4222-8222-222222222222', 1, 'readability:!!', 'Tone & readability', 'low', '!!', 'Brand rule: One exclamation mark at most', 'Repeated exclamation marks read as hype.', '!', 'open', NULL),
('22222222-2222-4222-8222-222222222222', 1, 'term-requires:free delivery', 'Terminology', 'high', 'Free delivery', 'Terminology: free delivery', 'Only say "free delivery" together with "above Rs 799".', 'Free delivery above Rs 799', 'open', NULL),
('11111111-1111-4111-8111-111111111111', 1, 'readability:length', 'Tone & readability', 'low', 'Rainy days call for something crunchy.', 'Brand rule: Keep sentences under 25 words', 'Checked and fine.', NULL, 'dismissed', 'False positive in an older rule version');

INSERT INTO public.comments (submission_id, author_role, body, created_at) VALUES
('11111111-1111-4111-8111-111111111111', 'reviewer', 'Lovely and on-brand. Approved for the monsoon campaign.', now() - interval '2 days');

INSERT INTO public.audit_log (submission_id, actor_role, action, details, created_at) VALUES
('11111111-1111-4111-8111-111111111111', 'creator', 'submitted', jsonb_build_object('revision', 1, 'body', 'Rainy days call for something crunchy. Our Almond Crunch pack is Rs 249, and delivery is free above Rs 799. Made with care since 2019.', 'open_findings', 0), now() - interval '3 days'),
('11111111-1111-4111-8111-111111111111', 'reviewer', 'approved', jsonb_build_object('revision', 1), now() - interval '2 days'),
('22222222-2222-4222-8222-222222222222', 'creator', 'submitted', jsonb_build_object('revision', 1, 'body', 'Greenleaf snacks are the cheapest and tastiest around!! Free delivery on all orders this weekend.', 'open_findings', 5), now() - interval '1 day');