.PHONY: serve build preview clean post deploy setup secrets

# Dev server with drafts at http://localhost:1313
serve:
	hugo server -D

# Production build into ./public
build:
	hugo --minify

# Build, then serve ./public the way Cloudflare Workers will — this runs the
# password gate (needs .dev.vars with GATE_PASSWORD + GATE_SECRET). `hugo server`
# does NOT run the gate; use this to test the protected post locally.
preview: build
	npx wrangler dev

# Remove generated output
clean:
	rm -rf public resources/_gen .hugo_build.lock

# New post: make post SLUG=my-post-title
post:
ifndef SLUG
	$(error usage: make post SLUG=my-post-title)
endif
	hugo new content posts/$(SLUG)/index.md

# Manual deploy from local machine (normally CI does this on push)
deploy: build
	npx wrangler deploy

# First-time setup after clone
setup:
	git submodule update --init
	npm install

# Set the password-gate secrets in Cloudflare (production). Run once; they
# persist across deploys. GATE_PASSWORD = shared password, GATE_SECRET = random
# cookie-signing key. For local testing put the same keys in .dev.vars instead.
secrets:
	npx wrangler secret put GATE_PASSWORD
	npx wrangler secret put GATE_SECRET
