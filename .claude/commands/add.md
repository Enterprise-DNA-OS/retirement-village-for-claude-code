---
description: "Add a record of any kind: a village, unit, resident, meeting."
---

# /add

Run help to see each kind's fields. Money fields take dollars without the _cents suffix.

```bash
node scripts/village.mjs add <kind> --field=value
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
