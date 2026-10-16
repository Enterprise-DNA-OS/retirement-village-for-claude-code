---
description: "Bill the month's weekly fees for every contract, with former residents charged only the share the rules allow."
---

# /fee-run

Always run with --dry-run first and show the total and any former residents on a reduced share. Run it for real only after a yes.

```bash
node scripts/village.mjs bill --month=YYYY-MM --dry-run
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
