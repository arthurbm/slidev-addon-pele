# Coding standards

Judgement calls for review. Mechanical rules live in the linter and CI, not here.

- **Glossary vocabulary.** Identifiers, messages and docs use the terms in `GLOSSARY.md` and none of its _Avoid_ words: a `step`, not a frame; `focus`/`reveal` mode, not highlight/build; a `preset`, not a theme, when it is ours.
- **Errors name the fix.** Every warning or error a presenter or agent can trigger says what to change, with the valid values when there is a closed set (ADR 0002).
- **Parity before invention.** An option Slidev documents for Mermaid blocks is honoured with Slidev's meaning, never silently ignored; new syntax follows an existing Slidev grammar (ADR 0002).
- **Small and plain.** Plain TypeScript and Vue. Pure modules return discriminated unions for results that can fail; only the component turns them into what the slide shows.
