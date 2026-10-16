# CLI reference

`npm run village -- <command>` or `node scripts/village.mjs <command>`. Reads accept --village= and --json. Money flags are dollars; *_cents fields are cents. Drafts go to drafts/ and are never sent. Record checks are not legal advice: docs/compliance.md.

- `villages`
- `units`
- `residents`
- `contracts`
- `vacancies`
- `exits`
- `resales`
- `charges [--month=YYYY-MM]`
- `arrears`
- `maintenance`
- `enquiries`
- `meetings`
- `agm`
- `occupancy`
- `compliance`
- `attention`
- `settings`
- `village <code>`
- `unit <code>`
- `contract <number>`
- `resident <name>`
- `exit <contract>`
- `insights [1..10]`
- `show <kind> <name|id>`
- `add <kind> --field=value`
- `update <kind> <name|id> --field=value`
- `move-in <unit> --contract=<number> --residents="Name; Name" --ingoing=dollars --on=date [--kind= --registered --dmf=%/yr --cap=% --base=ingoing|resale --share=% --refurb-share=% --fee=weekly]`
- `leave <contract> --ended=date [--vacated=date] [--stay-notice=date]`
- `valuation <contract> --amount=dollars [--on=date] [--agreed]`
- `refurb <unit> [--start=date] [--done=date] [--cost=dollars]`
- `advertise <unit> --price=dollars [--on=date]`
- `exit-paid <contract> [--on=date] [--amount=dollars] [--statement=date]`
- `statement <contract> [--on=date]`
- `bill --month=YYYY-MM [--dry-run]`
- `paid <charge> [--on=date]`
- `request <unit|village> <description> [--priority=urgent|high|normal] [--category=] [--by=]`
- `done <request> [--cost=dollars] [--on=date] [--resident-pays]`
- `enquiry <name> --village= [--wants= --source= --phone= --email= --next= --next-on=date]`
- `contact <enquiry> [--stage=] [--next=] [--next-on=date] [--lost=reason] [--on=date]`
- `meeting <village> --kind=AGM|special general|residents committee|budget --on=date [--notice=date]`
- `log <unit> <note>`
- `import centrim --file=residents.csv [--village=code] [--dry-run]`
- `import terms --file=contracts.csv [--dry-run]`
- `export --out=backup.json`
- `weekly-review`
- `draft-exit-statement <contract>`
- `draft-family-update <contract>`
- `draft-arrears <contract>`
- `draft-enquiry <enquiry>`
- `draft-agm-notice <village>`

## Record kinds for add, update and show

villages, units, contracts, residents, charges, maintenance, enquiries, meetings, notes, settings. Run `show <kind> <name>` to see every field. A `*_cents` field takes dollars without the suffix: `--ingoing=520000` sets `ingoing_cents`. A `*_id` field takes a name: `--village_id=KG`.

## Environment

- `DATABASE_URL`: a Postgres connection string. Unset, the embedded database in `.data/db` is used.
- `DATA_DIR`: where the embedded database lives (`.data/demo` for the demo).
- `OUTPUT_DIR`: where drafts, documents and views are written (the repo by default).
