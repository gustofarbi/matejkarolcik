# karolcik.com

Personal blog of Matej Karolcik — built with [Hugo](https://gohugo.io) and the [Congo](https://github.com/jpanther/congo) theme, hosted on [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

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
| `showComments: false` | Hide giscus comments for this post |
| `showTableOfContents: false` | Hide the ToC |
| `externalUrl` | Post entry links to an external article instead |

## Commands

| Command | Does |
|---|---|
| `make serve` | Dev server with drafts |
| `make build` | Production build into `./public` |
| `make preview` | Build + serve via `wrangler dev` (mirrors production 404/URL handling) |
| `make post SLUG=...` | Scaffold a new post |
| `make clean` | Remove generated output |
| `make deploy` | Manual deploy (CI deploys on push to `main` normally) |

## Structure

- `config/_default/` — Hugo + theme config (no root `hugo.toml` by design)
- `content/posts/` — blog posts as page bundles
- `layouts/partials/` — theme overrides: giscus comments, analytics beacon
- `themes/congo` — theme as git submodule (never edit; override in site root)
- `wrangler.jsonc` — Cloudflare Workers static-assets config
