# BrandLens

**Catch the errors in your content before your audience does.**

BrandLens is a pre-publication brand-governance web app. Content (a post, ad, email or document text) is checked against an organisation's approved brand guidelines, approved facts, terminology and visual rules *before* it is published. Every issue comes back with the rule it breaks and a suggested correction, and a human reviewer makes the final approval.

Built by **Team SMACKS** for **CodeZen India 2026** (Problem Statement by Inkloom AI), Round 2: The Build.

- **Live demo:** https://brand-ailens.lovable.app (no login needed)
- **Demo brand:** GreenLeaf Organics, a fictional organic-snacks brand created for this hackathon. No real confidential data is used.

## The problem

Organisations publish content through many employees, agencies and AI tools. Wrong prices, unsupported claims, inconsistent names and off-brand visuals are usually noticed only after publication, when credibility is already damaged. Style guides are static PDFs, and manual review is slow and inconsistent.

## How to try it (for judges)

1. Open the live link. No sign-in is required.
2. On **Create**, click **Load example**, then **Run Brand Check**.
3. Read each finding card: it shows the highlighted text, the rule or approved fact it breaks, an explanation and a suggested correction. **Accept**, **Edit** or **Dismiss** (dismissing needs a reason).
4. Click **Submit for review**.
5. Switch the role toggle to **Reviewer**, open the submission, add a comment, then **Approve** or **Request changes**.
6. Explore **Brand Knowledge** (guidelines, approved facts, terminology) and **Insights** (most frequent issue types).

## Features completed in Round 2

- [x] Creator studio: paste content, choose content type, optional image upload and text-on-colour design check
- [x] Deterministic rule engine (TypeScript): brand tone and banned hype words, terminology, approved-fact mismatches (prices, delivery threshold, dates), unsupported superlatives, image alt text, colour contrast
- [x] Finding cards with severity, highlighted text, cited rule or fact, explanation, and suggested correction
- [x] Accept / Edit / Dismiss flow (dismiss requires a reason)
- [x] Submit for review, Reviewer queue, comments, Approve / Request changes, status and revision history
- [x] Creator / Reviewer role switch (only a Reviewer can approve)
- [x] Brand Knowledge page to view and edit guidelines, facts and terminology
- [x] Insights page showing recurring issue types
- [x] Optional AI revision suggestions on request (human decides what to keep)
- [x] Spelling and grammar checks *(confirm this is live before submitting, otherwise move it to "Planned")*

## What it does not do yet

- Video is not supported.
- Poster analysis (logo, brand colours and text inside images) is planned. Images currently get alt-text and text-on-colour contrast checks only.
- Legal and regulatory checks are not included. BrandLens checks against the company's own rules and is **not legal advice**.

## Technology

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS (generated with Lovable) |
| Backend and database | Supabase / Lovable Cloud (PostgreSQL) *(confirm)* |
| Rule engine | TypeScript, deterministic rules (not AI) |
| AI (optional) | *(name the model or API used for "Suggest revision", or write "none")* |
| Hosting | Lovable publishing |
| Version control | GitHub |

## Architecture and key decisions

1. **Rules first, AI second.** The core checks are deterministic code, so results are repeatable and explainable. AI is used only for optional revision suggestions, so the product still works if an AI service fails.
2. **Every finding cites its source.** Each issue names the guideline or approved fact it relies on. Nothing is flagged without a rule behind it.
3. **Humans decide.** AI and rules only suggest. Only a Reviewer can approve content, and decisions are recorded with revision history.
4. **Demo-safe data.** The demo brand, rules and facts are fictional and seeded for testing.

Main data tables: `brand_rules`, `approved_facts`, `terminology`, `submissions`, `findings`, `comments`, `audit_log`.

## Disclosures

- **AI-assisted development:** The project was built with **Lovable** (AI app builder), with prompts and planning help from **Claude** (Anthropic). All code was generated and edited during the Round 2 build window.
- **External services:** Lovable (build and hosting), Supabase / Lovable Cloud (database), GitHub (source control), *(add any AI API used)*.
- **Libraries:** React, Vite, Tailwind CSS, shadcn/ui, Recharts *(adjust to match package.json)*.
- **Templates and earlier work:** Only the Lovable starter scaffold. No code from earlier projects was reused.
- **Data:** Brand rules, facts and sample content are written by the team. Some sample posts were pasted by testers during testing.

## User testing

The live app was tried by working professionals and other testers during Round 2. They reported that the core flow worked. Their feedback led to these changes:

| Feedback | Change made |
|---|---|
| It was unclear what the app does | New hero text and explainer |
| Audience not stated | "Who is this for?" section |
| Unsure which formats are supported | Honest "What can it check?" section |
| Asked what brand voice means and whether legality is checked | Plain-language explanations and a "not legal advice" note |
| Wanted spelling and grammar checks | Spelling and grammar category *(confirm)* |

## Run locally

```bash
git clone <this-repository-url>
cd <repository-folder>
npm install
npm run dev
```

Create a `.env` file with your own backend URL and public key (see `.env.example` if present). **Never commit API keys or secrets.**

## Team SMACKS

| Member | Role | Contribution |
|---|---|---|
| C Shrujan Reddy (Team Leader) | Coordination, backend and deployment | *(edit to what you actually did)* |
| Manya K | Frontend design | *(edit)* |
| Sharan K S | Frontend logic and testing | *(edit)* |
| Kusumanjali N T | UI/UX | *(edit)* |
| Shiva Prasad Pattanshetti | Testing and documentation | *(edit)* |
| Amaresh S | Rule content and AI prompts | *(edit)* |

## Planned for Round 3

1. Indian advertising and regulatory claims rule pack with escalation to a human reviewer
2. Poster and image analysis (text in images, logo, brand colours)
3. AI-grounded suggestions that cite approved sources, or DOCX/PDF upload *(final choices to be confirmed)*
