---
description: "Draft a kind reminder to a resident behind on fees."
---

# /draft-arrears

Check the payments received this week first. Never send.

```bash
node scripts/village.mjs draft-arrears "<contract>"
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
