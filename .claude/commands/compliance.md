---
description: "Check the records against the retirement village rules in docs/compliance.md (NSW exit orders and the 42-day cap, Queensland buy-back and shared charges, the NZ AGM) and report what is late or about to be."
---

# /compliance

Read docs/compliance.md first. Report as a table: rule, village, record, finding, date, source. Past dates first. For each finding, say the fix and offer the draft that goes with it. Nothing here is legal advice; if a rule looks out of date, say so and stop.

```bash
node scripts/village.mjs compliance [--village=<code>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
