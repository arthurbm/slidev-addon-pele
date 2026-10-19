## Agent skills

### Issue tracker

Issues e specs ficam no GitHub Issues de `arthurbm/slidev-addon-pele` (via `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` na raiz. See `docs/agents/domain.md`.

## Commands

- `pnpm check`: lint, format check, typecheck and the Node suite. `pnpm fix` fixes lint and format.
- `pnpm dev`: runs the Showcase deck (`showcase/`) at http://localhost:3030 and writes the dev server log to `showcase/dev.log` (git-ignored). Read it for `[pele]` warnings when verifying in the browser; browser console errors are forwarded there too.
- `pnpm test:browser`: the agent-browser suite against the Showcase deck (starts its own server on port 3040).

## Project docs

- Before touching the transformer, clicks, export, rendering or `data-id`s, read `docs/research/slidev-pele-internals.md`.
- Before writing a test, read `docs/testing.md`.
