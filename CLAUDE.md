# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Backend-developer portfolio of Matej Karolcik at https://karolcik.com — Hugo static site with the Congo theme, deployed to Cloudflare Workers (static assets) via Workers Builds on every push to `main`.

Audience is hiring managers and the engineers who evaluate him; the conversion action is an email. Evidence is problem → approach → outcome case studies under `/work`, not a technology logo wall. The blog is supporting material.

## Commands

```bash
make serve            # dev server at http://localhost:1313 (includes drafts)
make build            # production build into ./public
make preview          # build + wrangler dev (mirrors Workers 404/trailing-slash)
make post SLUG=...    # new blog post (page bundle)
make work SLUG=...    # new case study (page bundle, uses archetypes/work.md)
```

Requires Hugo **extended** >= 0.146.0 (CI pins `HUGO_VERSION=0.161.1` as a Workers Builds variable). No tests, no lint — `hugo --minify` exiting 0 is the build check.

After cloning: `make setup` (theme is a submodule).

## Architecture

- **Theme**: Congo v2.14.0, vendored as git submodule at `themes/congo` (branch `stable`). Never edit files inside `themes/congo` — override by placing files at the same relative path in the site root (`layouts/`, `assets/`).
- **Config**: split across `config/_default/*.toml` (Congo convention). There is deliberately **no root `hugo.toml`** — don't recreate one, and don't duplicate keys across files. `hugo.toml` holds core Hugo settings (baseURL, outputs — home must keep `"JSON"` for Congo search), `params.toml` holds theme params, `languages.<lang>.toml` holds title/author/description/email, `menus.<lang>.toml` the nav.
- **Languages**: EN + DE (`defaultContentLanguage = "en"`, no subdir → EN at root, `/de/` subtree). Slovak was removed deliberately — don't reintroduce it without asking. Congo auto-renders a language switcher + `hreflang` tags on any page that `.IsTranslated`. Theme UI strings come from `themes/congo/i18n/<lang>.yaml`; site-specific strings live in `i18n/<lang>.yaml` and **merge over** the theme's rather than replacing them.
- **Content sections**: `content/posts/` (blog, **English-only by design** — no `Blog` item in `menus.de.toml`, because a German link to an empty list is worse than no link) and `content/work/` (case studies, bilingual), both page bundles. `content/_index.md` feeds the custom homepage. Translations live in the same bundle as `index.de.md` — Hugo links them by bundle path, no `translationKey` needed.
- **Theme overrides** in `layouts/`:
  - `_partials/home/custom.html` — the portfolio landing page
  - `_partials/work-card.html` — case-study card, shared by landing and `/work`
  - `work/list.html` — `/work` index as a card grid ordered by front-matter `weight`
- **Styling**: `assets/css/custom.css`, auto-loaded by Congo and bundled into `main.bundle.min.css`. All bespoke classes are `pf-*`.
- **Design direction — prepress.** The site is a proof sheet: `<html>` is a neutral grey viewing surround, `<body>` is the white sheet, magenta crop marks sit at the sheet corners. One accent (`--magenta`), true black ink, Archivo (variable, width axis) for display and Newsreader for body. It comes from the subject matter — six years of renderers, masks and preview pipelines at a company that prints things. Deliberately avoids the generated-portfolio defaults: no all-caps eyebrows, no monospace metadata, no `→` on links, no middle-dot meta strings, no uniform rounded cards.
- **Fonts are self-hosted** in `static/fonts/` (~208 KB, latin subset, optical-size axis pinned). Not Google-served: embedding Google Fonts on a German-market site is a GDPR liability. Re-download with the axis ranges in the `@font-face` blocks if they ever need refreshing.
- **Author image** must live at `assets/img/author.jpg` — Congo reads it from `assets/`, not `static/`.
- **Deploy**: `wrangler.jsonc` defines a pure static-asset Worker (no `main` script) named `karolcik` — that name must match the Worker in the Cloudflare dashboard or builds fail. Workers Builds runs `hugo --minify` then `npx wrangler deploy`; `./public` is gitignored.

## Gotchas

- **Congo ships a precompiled Tailwind bundle and this repo has no Tailwind toolchain.** Utility classes the theme does not already emit (`grid-cols-3`, `md:grid-cols-2`, …) do **not** exist and render as nothing. Write plain CSS in `assets/css/custom.css` instead of reaching for utilities, or you get a silently unstyled page.
- **Congo puts the page wrapper classes on `<body>` itself** — `m-auto flex h-screen max-w-7xl …`. There is no wrapper div, so a selector like `body > div.m-auto` matches nothing. Style `body` directly, and add an attribute selector (`body.m-auto[class*="max-w-7xl"]`) to outrank Congo's own two-class `dark:bg-neutral-800`.
- **Hugo's CSS minifier strips the space after `var()` inside a shorthand value.** `background: … var(--len) 1px …` minifies to `var(--len)1px`, which is invalid, and the whole declaration is silently dropped — the dev server looks fine, the built site does not. Use longhand properties (`background-image` / `-position` / `-size`) when a custom property sits next to another value.
- **Headless Chrome will not go below a 500px window width.** Screenshots requested at 390px lay out at 500px and get cropped, which looks exactly like a horizontal-overflow bug. Breakpoints below 500px cannot be verified this way.
- **`layouts/_partials/home/custom.html` must stay at that exact path.** `themes/congo/layouts/index.html` gates it on `templates.Exists "_partials/home/custom.html"` — the literal `_partials/` path. Move it to `layouts/partials/` and Congo silently falls back to `home/page.html` with no build error.
- **`params.mainSections = ["posts"]` is load-bearing.** Without it Hugo infers main sections from whichever has the most pages, which flips the homepage "recent" list and RSS over to `work/` as soon as a third case study lands.
- `baseURL` (https://karolcik.com/) must stay the real domain — RSS/canonical URLs derive from it.
- `params.author.bio` is set but Congo's profile partial never renders it. Landing copy lives in `content/_index.md` and the custom homepage layout.
- Comments are removed site-wide (no Cusdis, no giscus). `article.showComments = false`.
- **Analytics needs no code.** karolcik.com is proxied through Cloudflare, so Web Analytics injects its beacon at the edge automatically — there is no snippet and no token in this repo. Don't add one back. (Automatic injection breaks only if a `Cache-Control: no-transform` header appears; the Worker currently sends `public, max-age=0, must-revalidate`.)
- Case studies follow an agreed disclosure rule: employer may be named, architecture at conference-talk depth, **no real internal metrics** — relative framing only.
