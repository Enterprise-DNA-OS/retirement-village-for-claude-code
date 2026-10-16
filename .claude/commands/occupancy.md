---
description: "Units, occupied, exits owed and open maintenance for every village."
---

# /occupancy

One line per village. Call out any village under 90% occupied.

```bash
node scripts/village.mjs occupancy
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
