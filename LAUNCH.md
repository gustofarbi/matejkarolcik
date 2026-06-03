# Launch checklist

Remaining steps to take karolcik.com live. Done so far: site built and pushed, domain registered on Cloudflare. (Repo no longer needs to be public — comments moved from giscus to Cusdis.)

## 1. Cusdis comments

1. Sign up at https://cusdis.com (free) → dashboard → **New Website**, domain `karolcik.com`.
2. Copy the **App ID** from the embed code shown for the new website.
3. Replace `CUSDIS_APP_ID` in `layouts/partials/comments.html`, commit, push.
4. Optional: dashboard → website settings → enable **email notifications** for new comments.

Note: comments are hidden until approved in the Cusdis dashboard.

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
- A post page renders the Cusdis widget at the bottom (test a comment — it appears in the cusdis.com dashboard pending approval; approve it to make it visible)
- Analytics: dashboard → Web Analytics shows visits after a few minutes
- Push a trivial commit → Builds tab shows a new deploy

## 6. Leftovers

- Replace `assets/img/author.jpg` (currently the Congo example photo) with a real one — same path, then push.
- Optional: grab `matejkarolcik.com` later → add as second custom domain or bulk-redirect to karolcik.com.
- Delete this file once everything is checked off.
