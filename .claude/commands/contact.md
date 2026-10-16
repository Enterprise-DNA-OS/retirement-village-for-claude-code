---
description: "Record a conversation with a prospect and the next step."
---

# /contact

Move the stage only when the operator says so.

```bash
node scripts/village.mjs contact "<enquiry>" [--stage=] [--next=] [--next-on=YYYY-MM-DD] [--lost=<reason>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
