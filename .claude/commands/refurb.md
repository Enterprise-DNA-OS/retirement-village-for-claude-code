---
description: "Record a refurbishment starting, finishing or its cost."
---

# /refurb

Then show the vacancies list for that village.

```bash
node scripts/village.mjs refurb "<unit>" [--start=YYYY-MM-DD] [--done=YYYY-MM-DD] [--cost=<dollars>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
