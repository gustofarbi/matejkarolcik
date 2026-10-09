# Launch checklist

Remaining steps to take karolcik.com live. Done so far: site built and pushed, domain registered on Cloudflare. (Comments have since been removed from the site entirely.)

## 1. Cloudflare Web Analytics

Nothing to install. karolcik.com is proxied through Cloudflare, so Web Analytics
uses **automatic setup** — the beacon is injected at the edge as HTML passes
through. The manual JS snippet (and its token) is only for sites that are *not*
proxied through Cloudflare, which is why no token exists for this site.

To check or change it: Cloudflare dashboard → **Web Analytics** → find
`karolcik.com` → **Manage site**. Options there are automatic (default),
automatic excluding EU visitors, manual snippet, or disabled.

## 2. Deploy to Cloudflare (Worker + git CI)

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

## 3. Custom domain

1. The Worker → **Settings → Domains & Routes → Add → Custom Domain**.
2. Add `karolcik.com`. Optionally add `www.karolcik.com` too.
3. Cloudflare creates the DNS record and TLS cert automatically (zone is already active from domain registration). Takes a minute or two.

## 4. Verify

```bash
curl -I https://karolcik.com                 # 200
curl -I https://karolcik.com/nonexistent     # 404 (custom 404 page)
```

- Homepage shows the custom portfolio landing (hero, Selected work, contact)
- `/work/` lists case studies; `/de/` mirrors the site in German
- Analytics: dashboard → Web Analytics shows visits after a few minutes
- Push a trivial commit → Builds tab shows a new deploy

## 5. Leftovers

- Replace `assets/img/author.jpg` (currently the Congo example photo) with a real one — same path, then push.
- Optional: grab `matejkarolcik.com` later → add as second custom domain or bulk-redirect to karolcik.com.
- Delete this file once everything is checked off.
