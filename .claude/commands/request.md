---
description: "Log a maintenance request for a unit or the common areas."
---

# /request

Ask the priority if the operator did not say: urgent is a safety or water problem.

```bash
node scripts/village.mjs request "<unit or village>" <description> [--priority=urgent|high|normal] [--category=] [--by=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
