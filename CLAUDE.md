# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal blog of Matej Karolcik at https://karolcik.com — Hugo static site with the Congo theme, deployed to Cloudflare Workers (static assets) via Workers Builds on every push to `main`.

## Commands

```bash
hugo server -D        # dev server at http://localhost:1313 (includes drafts)
hugo --minify         # production build into ./public
npx wrangler dev      # serve ./public the way Workers will (404/html handling)
hugo new content posts/<slug>/index.md   # new post (page bundle)
```

Requires Hugo **extended** >= 0.146.0 (CI pins `HUGO_VERSION=0.161.1` as a Workers Builds variable). No tests, no lint — `hugo --minify` exiting 0 is the build check.

After cloning: `git submodule update --init` (theme is a submodule).

## Architecture

- **Theme**: Congo, vendored as git submodule at `themes/congo` (branch `stable`). Never edit files inside `themes/congo` — override by placing files at the same relative path in the site root (`layouts/`, `assets/`).
- **Config**: split across `config/_default/*.toml` (Congo convention). There is deliberately **no root `hugo.toml`** — don't recreate one, and don't duplicate keys across files. `hugo.toml` holds core Hugo settings (baseURL, outputs — home must keep `"JSON"` for Congo search), `params.toml` holds theme params, `languages.en.toml` holds title/author/social links, `menus.en.toml` the nav.
- **Languages**: site is multilingual (`defaultContentLanguage = "en"`, no subdir → EN at root, `/sk/` + `/de/` subtrees). Each language has a `languages.<lang>.toml` (title/author/description) and `menus.<lang>.toml` (translated nav) in `config/_default/`. Congo auto-renders a language switcher + `hreflang` tags on any page that `.IsTranslated`. UI strings come from `themes/congo/i18n/<lang>.yaml`.
- **Theme overrides** in `layouts/partials/`: `comments.html` (Cusdis widget, injected by Congo when `showComments = true`) and `extend-head.html` (Cloudflare Web Analytics beacon, production builds only).
- **Author image** must live at `assets/img/author.jpg` — Congo reads it from `assets/`, not `static/`.
- **Deploy**: `wrangler.jsonc` defines a pure static-asset Worker (no `main` script) named `karolcik` — that name must match the Worker in the Cloudflare dashboard or builds fail. Workers Builds runs `hugo --minify` then `npx wrangler deploy`; `./public` is gitignored.
- **Content**: posts are page bundles under `content/posts/<slug>/index.md`. `content/_index.md` front matter feeds the profile-layout homepage. Translations live in the same bundle as `index.<lang>.md` (e.g. `index.sk.md`, `index.de.md`) — Hugo links them automatically by bundle path, no `translationKey` needed. See `content/posts/ecce-homo/` for the pattern.

## Gotchas

- `baseURL` (https://karolcik.com/) must stay the real domain — RSS/canonical URLs derive from it. Cusdis maps comments by `data-page-id` (= `.RelPermalink`), so changing a post's URL orphans its comments.
- Cusdis comments are **hidden until approved** in the cusdis.com dashboard — a missing comment usually means pending moderation, not a bug.
- Placeholder tokens `CUSDIS_APP_ID` (`layouts/partials/comments.html`) and `CF_ANALYTICS_TOKEN` (`layouts/partials/extend-head.html`) must be replaced with real values before those features work.
