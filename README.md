# karolcik.com

Backend-developer portfolio of Matej Karolcik — built with [Hugo](https://gohugo.io) and the [Congo](https://github.com/jpanther/congo) theme, hosted on [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

## Setup

Requires [Hugo extended](https://gohugo.io/installation/) >= 0.146.0 and Node 18+.

```bash
brew install hugo
git clone git@github.com:gustofarbi/matejkarolcik.git
cd matejkarolcik
make setup          # init theme submodule, install wrangler
make serve          # dev server at http://localhost:1313
```

## Writing a post

1. Scaffold a new post:

   ```bash
   make post SLUG=my-post-title
   ```

   This creates `content/posts/my-post-title/index.md` as a [page bundle](https://gohugo.io/content-management/page-bundles/) — images and other files for the post live in the same directory.

2. Edit the front matter:

   ```yaml
   ---
   title: "My Post Title"
   date: 2026-06-03
   draft: true
   summary: "One-liner shown in the post list."
   tags: ["tag1", "tag2"]
   ---
   ```

3. Write the content in Markdown below the front matter. Images go next to `index.md` and are referenced by filename:

   ```markdown
   ![Alt text](my-image.jpg)
   ```

4. Preview with `make serve` (drafts are visible locally at http://localhost:1313).

5. Publish: set `draft: false`, then commit and push:

   ```bash
   git add content/posts/my-post-title
   git commit -m "Add post: my post title"
   git push
   ```

   Cloudflare Workers Builds picks up the push and deploys automatically.

### Useful front matter options

| Key | Effect |
|---|---|
| `summary` | Text shown in the post list (otherwise auto-generated) |
| `tags` | Taxonomy tags, browsable at `/tags/` |
| `showTableOfContents: false` | Hide the ToC |
| `externalUrl` | Post entry links to an external article instead |

## Commands

| Command | Does |
|---|---|
| `make serve` | Dev server with drafts |
| `make build` | Production build into `./public` |
| `make preview` | Build + serve via `wrangler dev` (mirrors production 404/URL handling) |
| `make post SLUG=...` | Scaffold a new post |
| `make work SLUG=...` | Scaffold a new case study |
| `make clean` | Remove generated output |
| `make deploy` | Manual deploy (CI deploys on push to `main` normally) |

## Writing a case study

Case studies live in `content/work/` and are the main evidence on this site.

```bash
make work SLUG=order-pipeline
```

Front matter that matters:

| Key | Effect |
|---|---|
| `summary` | The one line shown on the card. Name the *problem*, not the technology. |
| `stack` | List of strings, rendered as tags on the card, e.g. `["Go", "Kafka"]` |
| `weight` | Sort order on `/work` and the homepage — lower first. Most convincing case study gets the lowest weight. |

Structure the body as **problem → constraints → what I did → outcome**. Congo's
`{{< mermaid >}}` shortcode renders architecture diagrams; `{{< badge >}}` gives
inline tags.

Disclosure rule for this site: the employer may be named and the architecture
described at the depth a conference talk would use, but **no real internal
metrics** — use relative framing instead.

## Structure

- `config/_default/` — Hugo + theme config (no root `hugo.toml` by design)
- `content/work/` — case studies as page bundles (the portfolio)
- `content/posts/` — blog posts as page bundles
- `i18n/` — site-specific UI strings, merged over the theme's
- `layouts/_partials/home/custom.html` — the portfolio landing page
- `layouts/work/list.html` — `/work` card grid
- `assets/css/custom.css` — all bespoke styling (`pf-*` classes, plain CSS — see CLAUDE.md)
- `themes/congo` — theme as git submodule (never edit; override in site root)
- `wrangler.jsonc` — Cloudflare Workers static-assets config
