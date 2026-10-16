---
description: "Change fields on any record, or a setting."
---

# /update

Show the record first with show, then update.

```bash
node scripts/village.mjs update <kind> "<name or id>" --field=value
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
