---
description: "Close a maintenance request with its cost."
---

# /done

Say whether the resident pays, from the operator.

```bash
node scripts/village.mjs done "<request>" [--cost=<dollars>] [--resident-pays]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
