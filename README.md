<h1 align="center">Retirement Village for Claude Code</h1>

<p align="center">
  <strong>The open-source retirement village system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Centrim Life data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=centrim-life">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/centrim-life?utm_source=github&utm_medium=readme&utm_campaign=centrim-life">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-centrim-life">Instead of Centrim Life</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Retirement Village for Claude Code does the job you pay Centrim Life for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Centrim Life dashboard cannot.

Centrim Life does not publish a price: its Australian seller, Person Centred Software, offers a demo booking, not a price list (personcentredsoftware.com, checked 16 October 2026). The money side of a village (contracts, deferred management fees, exit entitlements) usually sits in a second system, such as a finance package or Inerva's cloud ERP, also quoted privately. Here there is no licence fee: the database is yours.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=centrim-life).

It covers how a retirement village operator actually runs: villages and their units, residents and their contracts (licence to occupy or lease, with the deferred management fee terms), weekly fees billed by the rules, departures and the exit entitlement owed back, the resale (valuation, refurbishment, advertising, the next resident), maintenance requests against target times, prospective residents, and residents' meetings. It knows the rules that bite: the NSW exit entitlement order clock and the 42-day fee cap, the Queensland 18-month buy-back and shared charges, and the New Zealand AGM deadline. It is for the village manager, accounts and sales staff at an operator with one to a dozen villages in New Zealand or Australia.

What it is not: a clinical care or aged care system, a resident app, a dining or visitor kiosk. Those screens stay where they are; see [docs/why-no-front-end.md](docs/why-no-front-end.md).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No licence quote, no seats. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/retirement-village-for-claude-code.git
cd retirement-village-for-claude-code
npm install
npm run demo
```

`npm run demo` loads a fictional operator with three villages (one each in New Zealand, New South Wales and Queensland) into `.data/demo` and prints what needs attention, the exit entitlements owed and the record checks. Then open the folder in Claude Code and type `/attention`, or ask "who are we still paying out, and by when?".

```bash
npm test                                   # 130+ checks on a throwaway database
DATA_DIR=.data/demo npm run village -- exit BR-0301
DATA_DIR=.data/demo npm run village -- insights 1
DATA_DIR=.data/demo npm run view           # views/week.html, vacancies.html, money.html, compliance.html
DATA_DIR=.data/demo npm run docs           # docs-out/: exit entitlement statements, fee statements, AGM packs
```

For real records, use a fresh database and run `npm run migrate` without seeding. Add your villages, then import your Centrim Life resident list and your contract terms.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that needs someone today: exit money and rule dates, overdue maintenance, fees behind, empty units dragging, enquiries gone quiet. |
| `/weekly-review` | Write the Monday village review from attention, occupancy and record checks. |
| `/occupancy` | Units, occupied, exits owed and open maintenance for every village. |
| `/village` | One village: its units, who lives where, exits owed and what needs attention. |
| `/unit` | One unit: every occupancy, the resale in progress, maintenance and notes. |
| `/residents` | Who lives where, with phone and next of kin. |
| `/exits-due` | Every departed resident still owed their exit entitlement, how much, and the date it is due or the order date. |
| `/exit` | Work out one former resident's exit entitlement line by line: ingoing, deferred management fee, capital gain share, refurbishment share, unpaid fees. |
| `/departure` | Record a resident leaving: the termination date and the day the keys came back. |
| `/valuation` | Record the agreed resale value or an independent valuation for a departed resident's unit. |
| `/refurb` | Record a refurbishment starting, finishing or its cost. |
| `/advertise` | Record a unit going on the market at an asking price. |
| `/vacancies` | Every unit between residents: the stage it is at, days empty and the fees not coming in. |
| `/move-in` | Settle a new resident into a unit: the contract, the residents, the ingoing and the terms. Closes the resale and starts the clock on the last resident's exit payment. |
| `/exit-paid` | Record an exit entitlement paid out. Unpaid fees are marked as deducted. |
| `/statement` | Record that the written exit statement was given. |
| `/fee-run` | Bill the month's weekly fees for every contract, with former residents charged only the share the rules allow. |
| `/arrears` | Residents behind on their weekly fees. |
| `/paid` | Record a fee payment. |
| `/maintenance` | Open maintenance requests against their target dates. |
| `/request` | Log a maintenance request for a unit or the common areas. |
| `/done` | Close a maintenance request with its cost. |
| `/enquiries` | Prospective residents and where each one is up to. |
| `/enquiry` | Add a new prospective resident. |
| `/contact` | Record a conversation with a prospect and the next step. |
| `/agm` | AGM dates for every village: the year end, the deadline and the last meeting held. |
| `/meeting` | Record an AGM, special general meeting, residents committee meeting or budget meeting. |
| `/compliance` | Check the records against the retirement village rules in docs/compliance.md (NSW exit orders and the 42-day cap, Queensland buy-back and shared charges, the NZ AGM) and report what is late or about to be. |
| `/insights` | Answer one or all of the ten questions across the records. |
| `/draft-exit-statement` | Draft the written statement of how a former resident's exit entitlement was worked out. |
| `/draft-family-update` | Draft an update to a former resident's family or executor: refurbishment, advertising, sale and the expected exit payment. |
| `/draft-arrears` | Draft a kind reminder to a resident behind on fees. |
| `/draft-enquiry` | Draft a follow-up to a prospective resident with the units coming available. |
| `/draft-agm-notice` | Draft the notice and agenda for a village's annual general meeting. |
| `/log` | Add a note to a unit (and its latest contract). |
| `/add` | Add a record of any kind: a village, unit, resident, meeting. |
| `/update` | Change fields on any record, or a setting. |
| `/import` | Bring residents and units across from a Centrim Life resident list, then contract terms from the finance system, saved as CSV. |
| `/export` | Write every record to one JSON file. |
| `/documents` | Render exit entitlement statements, fee statements and AGM packs as branded HTML. |
| `/view` | Render the read-only dashboards: the week, empty units, money owed both ways and record checks. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |

The full CLI reference is [docs/cli.md](docs/cli.md). Every read takes `--json` and `--village=`. Names match without case, fragments work, and an ambiguous name lists the candidates and exits 1. Drafts go to `drafts/` and are never sent.

## Ten questions to ask across your own records

These run today with `npm run village -- insights`:

1. How long does each village take to relicense a unit, from keys back to the next resident settling?
2. What are empty units costing in weekly fees nobody is paying?
3. How much exit money is owed, by village, and when is the first payment due?
4. What deferred management fee has each village earned on departures in the last 12 months?
5. How did each resale price compare with the departing resident's ingoing?
6. Which residents are behind on fees, and by how much?
7. Which maintenance categories cost the most in the last 12 months, by village?
8. How fast is maintenance done against its target, by village and priority?
9. Which enquiry sources turn into residents?
10. How long do residents stay, by village and unit type?

## Record checks

`/compliance` checks the records against these rules. Each rule, its source and its limits are in [docs/compliance.md](docs/compliance.md). The periods are settings.

| Rule | What it flags |
|---|---|
| `NSW-EXIT-ORDER` | A registered interest holder unpaid 6 months (metropolitan) or 12 months (elsewhere) after the clock starts, 40 days after advertising, keys back or stay notice (Retirement Villages Act 1999 NSW) |
| `NSW-AGREED-VALUATION` | No agreed valuation 30 days before an order could be sought |
| `NSW-CHARGE-CAP` | A former resident billed past 42 days beyond their capital gain share (s 152) |
| `QLD-BUYBACK` | An exit entitlement unpaid 18 months after termination (Retirement Villages Act 1999 Qld s 63) |
| `QLD-SHARED-CHARGES` | A former resident billed in full past 90 days, or anything past 9 months (s 104) |
| `QLD-RESALE-VALUE` | No agreed resale value or valuation 30 days after termination |
| `QLD-EXIT-STATEMENT` | An exit paid with no written statement of how it was worked out |
| `NZ-AGM` | No annual general meeting within six months of the financial year end (Code of Practice 2008 cl 26(1)) |

The fee run applies the same rules as it bills, so a former resident is charged only what the Act allows.

## Documents and views

`npm run docs` renders, in your brand from `brand.json`: an exit entitlement statement for every departure (the working, the contract terms, fees after leaving, the resale and the payment), a fee statement for every current resident, and an AGM pack for every village (occupancy, the maintenance report, fees billed and collected). `npm run view` renders four read-only dashboards: the week, empty units, money owed both ways, and record checks. Print them or open them in a browser.

## Your first hour: ten things to ask for

1. "Our business is Harbourview Living. Add Kowhai Grove in Tauranga, New Zealand, financial year ending March, supervised by our trustee."
2. "Import the resident list from Centrim Life." (dry run first)
3. "Import our contract terms from the finance spreadsheet."
4. "What needs someone today?"
5. "Joan Whitfield's family handed the keys back on Friday. Record it and tell me what we owe and by when."
6. "The valuer says BR-03 is worth $820,000 and the family agreed. What is her exit now?"
7. "Bill November's fees, dry run first."
8. "Who is behind on fees? Draft a kind note to the oldest."
9. "Draft the AGM notice for Kowhai Grove."
10. "Our contracts stop fees 28 days after keys back in New Zealand, and add a car park number to every unit." (that is `/customise`)

## Instead of Centrim Life

Centrim Life holds resident and property records, maintenance, communications, dining, feedback and visitor management for retirement living (personcentredsoftware.com, checked 16 October 2026). It does not publish an export guide, so ask your account contact for the resident list as a spreadsheet: one row per resident with the village, unit, name, contact details, move-in date and next of kin. Save it as CSV and import it:

```bash
npm run village -- import centrim --file=residents.csv --dry-run
npm run village -- import centrim --file=residents.csv
npm run village -- import terms --file=contracts.csv     # ingoing, DMF and weekly fee from your finance system
```

Add the villages first. Units are created as they appear; a couple in one unit becomes one contract with two residents. The import matches on the unit and the resident's name, so you can run it again. Maintenance history, messages and dining orders do not come across in this version. Read [docs/replace-centrim-life.md](docs/replace-centrim-life.md) for the column names and what maps where. Fictional examples are in `examples/centrim-life/`.

## Architecture

```
retirement-village-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/village.mjs       the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema, the exit sums, the fee rules and the record checks
  supabase/seed.sql         demo data: three fictional villages, exits coming due, fees over the cap, a late AGM
  views.json                read-only dashboards (npm run view)
  documents.json            exit statements, fee statements, AGM packs (npm run docs)
  examples/centrim-life/    fictional resident list and contract terms for the import
  docs/                     the rules, the CLI reference and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Retirement Village for Claude Code for your business, migrates your Centrim Life data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=centrim-life)
- Read more: [enterprisedna.co/omni/instead-of/centrim-life](https://enterprisedna.co/omni/instead-of/centrim-life?utm_source=github&utm_medium=readme&utm_campaign=centrim-life)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
