---
description: "Bring residents and units across from a Centrim Life resident list, then contract terms from the finance system, saved as CSV."
---

# /import

Read docs/replace-centrim-life.md. Add the villages first. Always run with --dry-run first and show the counts. Residents before terms.

```bash
node scripts/village.mjs import centrim --file=<residents.csv> [--village=<code>] --dry-run
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
