---
description: "Settle a new resident into a unit: the contract, the residents, the ingoing and the terms. Closes the resale and starts the clock on the last resident's exit payment."
---

# /move-in

Read the last contract on the unit first: terms carry over unless the operator gives new ones. Confirm the ingoing and settlement date before running.

```bash
node scripts/village.mjs move-in "<unit>" --contract=<number> --residents="Name; Name" --ingoing=<dollars> --on=YYYY-MM-DD [--enquiry="<name>"] [--dmf= --cap= --base= --share= --fee=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
