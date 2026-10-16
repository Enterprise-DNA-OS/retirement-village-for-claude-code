---
description: "Write the Monday village review from attention, occupancy and record checks."
---

# /weekly-review

The CLI saves a review in drafts/. Read it and give the operator their three priorities for the week.

```bash
node scripts/village.mjs weekly-review
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
