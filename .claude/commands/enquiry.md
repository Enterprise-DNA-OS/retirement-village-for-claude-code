---
description: "Add a new prospective resident."
---

# /enquiry

Ask for a next step and a date if none was given.

```bash
node scripts/village.mjs enquiry "<name>" --village=<code> [--wants=] [--source=] [--phone=] [--email=] [--next=] [--next-on=YYYY-MM-DD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
