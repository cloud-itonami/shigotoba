# Operator quickstart

What an operator can actually run in this repo today, what they cannot, and how
to re-measure both. Every command below was executed against commit `ef46c11`
on 2026-08-31; every claim is paired with the command that re-derives it, so
this file can be checked rather than trusted.

## 0. What this repo is right now

`README.md` describes a global job marketplace (search, applications, MCP
tools, `shigotoba.etzhayyim.com`). That is the **design record** carried over
from the `etzhayyim/root` monorepo — see `migration.edn` — not a description of
something running.

What is actually here:

| Path | State | Runs here? |
|---|---|---|
| `facts/catalog.edn` + `tools/verify_citations.kotoba` | live, gated | **yes** — §1 |
| `kotoba/` (TypeScript registry + vitest suite) | source present | no — §2 |
| `appview/` (SvelteKit component, `wrangler.jsonc`) | source present, unbuilt | no — §3 |

`deps.edn` says the same thing in one line: `:deps {}`, "citation catalog leaf
does not pull JVM libs". Treat the repo as a **citation-catalog leaf with an
attached design record** until §2 and §3 change.

## 1. The one gate that runs — citation freshness

`facts/catalog.edn` pins the public job-board endpoints that
`appview/shigotoba-jobs-component/DATA_SOURCES.md` claims as the catalogue
feed, plus the schema vocabularies and this repo's own GitHub surface. The gate
fetches every one of them.

```bash
nbb tools/verify_citations.kotoba
```

Measured at `ef46c11`: `CHECKED 11 OK 11 FAIL 0 MIN 8` → `PASS`, exit 0.

### Exit codes

The gate keeps "nothing was wrong" and "nothing was checked" on **different**
exit codes. That distinction is the point of the tool, so it is stated here as
a contract and verified below.

| Exit | Meaning |
|---|---|
| `0` | Every citation answered 2xx, every `:cite/expect-substring` was present, and at least `--min` (default 8) citations were checked |
| `1` | The gate ran and at least one citation is wrong — `DRIFT <id> <why>` names which |
| `2` | The gate **could not answer** — missing/unparseable catalog, zero entries, fewer than `--min` checks, or a transport failure |

Do not read exit 2 as "fine". It means the run produced no verdict.

### Confirming the gate still discriminates

A gate that cannot go red is decoration. Before relying on a green run, break
it and check that **what reddens is what you broke** — the failure must name
the id you touched, not merely be non-zero. All five were run at `ef46c11`:

```bash
# (a) unreachable URL -> exit 1, DRIFT names that id
sed 's|https://schema.org/JobPosting|https://example.invalid/nope|' \
  facts/catalog.edn > /tmp/broken-url.edn
nbb tools/verify_citations.kotoba /tmp/broken-url.edn --quiet
#   DRIFT :schema/job-posting fetch-error getaddrinfo ENOTFOUND example.invalid   exit 1

# (b) URL answers 2xx but no longer says what we claim -> exit 1
sed 's|:cite/expect-substring "JobPosting"|:cite/expect-substring "NotOnThatPage"|' \
  facts/catalog.edn > /tmp/bad-substr.edn
nbb tools/verify_citations.kotoba /tmp/bad-substr.edn --quiet
#   DRIFT :schema/job-posting missing substring "NotOnThatPage"                   exit 1

# (c) empty catalog -> exit 2, NOT 0
printf '{:catalog/id "empty" :catalog/entries []}\n' > /tmp/empty.edn
nbb tools/verify_citations.kotoba /tmp/empty.edn --quiet
#   EMPTY catalog entries                                                          exit 2

# (d) unparseable catalog -> exit 2
printf '{:catalog/entries [ unclosed\n' > /tmp/broken.edn
nbb tools/verify_citations.kotoba /tmp/broken.edn --quiet
#   PARSE-FAIL Unexpected EOF while reading item 1 of vector.                      exit 2

# (e) everything checked passed, but too few were checked -> exit 2, NOT 0
#     (two live, passing citations; the floor still refuses to call it a pass)
cat > /tmp/short.edn <<'EOF'
{:catalog/id "short"
 :catalog/entries
 [{:cite/id :schema/job-posting
   :cite/url "https://schema.org/JobPosting"
   :cite/expect-substring "JobPosting"}
  {:cite/id :w3/json-ld11
   :cite/url "https://www.w3.org/TR/json-ld11/"
   :cite/expect-substring "JSON-LD"}]}
EOF
nbb tools/verify_citations.kotoba /tmp/short.edn
#   CHECKED 2 OK 2 FAIL 0 MIN 8 / FLOOR below --min 8 got 2                        exit 2
```

Case (e) is the one worth internalising: two citations were fetched, both
returned 200, both matched their substring — and the gate still refused,
because eight was the amount of evidence the catalog promised.

Capture the exit code from the gate itself, not from a pipeline:

```bash
nbb tools/verify_citations.kotoba > /tmp/gate.log 2>&1; echo "EXIT=$?"   # the gate's code
nbb tools/verify_citations.kotoba | tail -5; echo "EXIT=$?"             # tail's code — wrong
```

### Editing the catalog

Add a citation only if it passes the gate. `:cite/expect-substring` should be a
phrase that would disappear if the page stopped meaning what the catalog claims
— a 200 from a parked domain is not a citation. `--min` is a floor on evidence,
so lower it only alongside a deliberate decision to claim less; raise it when
you add sources.

## 2. `kotoba/` — does not install on this workstation

`kotoba/` is a TypeScript registry (`companyProfile` / `jobPosting` on an AT
PDS) with a real vitest suite in `test/shigotoba.test.ts`. It does not run
here, and the reason is **local tooling, not the package**:

```bash
cd kotoba && npm install     # npm error code EALLOWSCRIPTS
                             # "--allow-scripts is not allowed in project-scoped installs"
```

Measured with node v26.7.0 / npm 11.19.0. The failure is in npm's own nested
`--force` invocation while preparing a `git+https` dependency. Discriminated
three ways, so this is not a guess:

```bash
git ls-remote https://github.com/etzhayyim/com-etzhayyim-sdk.git HEAD  # resolves — dep is public and reachable
npm install vitest@^4.1.0                                             # exit 0 — registry deps install fine
npm install git+https://github.com/etzhayyim/com-etzhayyim-sdk.git    # exit 1, EALLOWSCRIPTS — any git dep fails
```

So: registry dependencies install, the dependency repositories exist and are
reachable, and every `git+https` dependency fails identically. Re-run the three
commands above after an npm upgrade; if the third one passes, `npm test` in
`kotoba/` becomes a second gate for this repo. **Until it runs, this suite is
unverified — not passing and not failing.**

This is the same shape as the `npx --yes` breakage recorded in the workspace
AGENTS.md: red on this machine, fine elsewhere. Check a fleet node before
concluding the repo is broken.

## 3. `appview/` — design record, not a deployment

`appview/README.md` documents `etzhayyim build` then `kubectl apply`, and
`wrangler.jsonc` points a Worker at `svelte/.svelte-kit/cloudflare/_worker.js`.
None of that is executable from this checkout today:

```bash
command -v etzhayyim                              # not on PATH
ls appview/shigotoba-jobs-component/svelte/.svelte-kit   # No such file or directory — never built
```

The `main` that `wrangler.jsonc` names is a build output that does not exist,
so `wrangler deploy` has nothing to publish.

Nor is the documented product live. `README.md` and `PROJECT.jsonld` both claim
`shigotoba.etzhayyim.com`; `wrangler.jsonc` routes `a80c21a0.etzhayyim.com`.
Neither host has a DNS record:

```bash
dig +short shigotoba.etzhayyim.com    # empty
dig +short a80c21a0.etzhayyim.com     # empty
dig +short etzhayyim.com              # 172.67.179.128 104.21.51.111 — the zone exists; these two names do not
```

The parent zone resolving while the subdomains do not is the informative part:
this was never deployed, rather than deployed and later withdrawn.

Two constraints before anyone revives this surface:

- The UI is SvelteKit. Workspace rule ADR-2608260900 retires Svelte as an
  authoring surface — **do not add `.svelte`/`.tsx`/`.jsx` files**. A revival is
  a port to cljs + reagent + re-frame on `jp-go-dds`, not a `npm run build`.
- `PROJECT.jsonld` still declares `"stack": "go"` and `"tier": "event-driven"`
  against a SvelteKit-on-Cloudflare component. Reconcile that before treating
  either file as the deployment contract.

## 4. If you change one thing

Run §1 and confirm exit 0. That is the only automated check this repo has —
`deps.edn` declares no test alias, and §2 and §3 do not execute here. Anything
you believe about `kotoba/` or `appview/` is unverified until the corresponding
blocker above is cleared.
