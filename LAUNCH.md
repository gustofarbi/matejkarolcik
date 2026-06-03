# Launch checklist

Remaining steps to take karolcik.com live. Done so far: site built and pushed, repo public with Discussions enabled, domain registered on Cloudflare.

## 1. Giscus comments

1. Install the giscus GitHub app: https://github.com/apps/giscus → Install → select only `gustofarbi/matejkarolcik`.
2. Verify the **Announcements** discussion category exists (repo → Discussions → ⚙️ edit categories). Announcements is right for comments — only maintainers/giscus can create discussions there.
3. Go to https://giscus.app → Configuration:
   - Repository: `gustofarbi/matejkarolcik`
   - Page ↔ Discussions mapping: `pathname` (default)
   - Category: **Announcements**
4. In the generated "Enable giscus" script, copy:
   - `data-repo-id` (starts with `R_`)
   - `data-category-id` (starts with `DIC_`)
5. Replace `GISCUS_REPO_ID` and `GISCUS_CATEGORY_ID` in `layouts/partials/comments.html`, commit, push.

## 2. Cloudflare Web Analytics

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site**.
2. Hostname: `karolcik.com`. Choose the **manual JS snippet** option (not automatic injection — we control the snippet in the partial).
3. Copy the `token` value from the shown snippet.
4. Replace `CF_ANALYTICS_TOKEN` in `layouts/partials/extend-head.html`, commit, push.

## 3. Deploy to Cloudflare (Worker + git CI)

This connects the repo so every push to `main` builds and deploys automatically.

1. Dashboard → **Workers & Pages → Create → Workers → Import a repository**.
2. Authorize GitHub access, select `gustofarbi/matejkarolcik`.
3. Configure the project:
   - **Worker name**: `karolcik` — must exactly match `name` in `wrangler.jsonc`, build fails otherwise
   - **Build command**: `hugo --minify`
   - **Deploy command**: `npx wrangler deploy`
   - **Root directory**: `/`
   - **Build variable**: `HUGO_VERSION` = `0.161.1` (pins CI to the locally tested version; resolves to the extended build Congo needs)
4. Save → first build runs immediately. Watch it under the Worker's **Builds** tab.
5. The site is now live at `karolcik.workers.dev` (subdomain shown on the Worker overview).

### Alternative: manual deploy from local

```bash
npx wrangler login    # once
make deploy           # hugo --minify && npx wrangler deploy
```

Useful before git CI is connected, or for emergency pushes. Normal flow stays git push → auto-deploy.

## 4. Custom domain

1. The Worker → **Settings → Domains & Routes → Add → Custom Domain**.
2. Add `karolcik.com`. Optionally add `www.karolcik.com` too.
3. Cloudflare creates the DNS record and TLS cert automatically (zone is already active from domain registration). Takes a minute or two.

## 5. Verify

```bash
curl -I https://karolcik.com                 # 200
curl -I https://karolcik.com/nonexistent     # 404 (custom 404 page)
```

- Homepage shows profile layout, posts list, About in menu
- A post page renders the giscus widget at the bottom (test a comment — it appears in repo Discussions)
- Analytics: dashboard → Web Analytics shows visits after a few minutes
- Push a trivial commit → Builds tab shows a new deploy

## 6. Leftovers

- Replace `assets/img/author.jpg` (currently the Congo example photo) with a real one — same path, then push.
- Optional: grab `matejkarolcik.com` later → add as second custom domain or bulk-redirect to karolcik.com.
- Delete this file once everything is checked off.
