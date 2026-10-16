---
description: "Record an exit entitlement paid out. Unpaid fees are marked as deducted."
---

# /exit-paid

Run /exit first and show the figure. Ask whether the written statement went with it, and pass --statement if it did.

```bash
node scripts/village.mjs exit-paid "<contract>" [--on=YYYY-MM-DD] [--amount=<dollars>] [--statement=YYYY-MM-DD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
