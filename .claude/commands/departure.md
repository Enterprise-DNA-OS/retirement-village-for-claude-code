---
description: "Record a resident leaving: the termination date and the day the keys came back."
---

# /departure

Confirm the contract and dates with the operator first. After it runs, give the exit estimate, the due date or order date, and the next three steps.

```bash
node scripts/village.mjs leave "<contract>" --ended=YYYY-MM-DD [--vacated=YYYY-MM-DD] [--stay-notice=YYYY-MM-DD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
