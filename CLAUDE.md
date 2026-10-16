# Retirement Village for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| everything that needs someone today: exit money and rule dates, overdue maintenance, fees behind, empty units dragging, enquiries gone quiet | `/attention` |
| write the Monday village review from attention, occupancy and record checks | `/weekly-review` |
| units, occupied, exits owed and open maintenance for every village | `/occupancy` |
| one village: its units, who lives where, exits owed and what needs attention | `/village` |
| one unit: every occupancy, the resale in progress, maintenance and notes | `/unit` |
| who lives where, with phone and next of kin | `/residents` |
| every departed resident still owed their exit entitlement, how much, and the date it is due or the order date | `/exits-due` |
| work out one former resident's exit entitlement line by line: ingoing, deferred management fee, capital gain share, refurbishment share, unpaid fees | `/exit` |
| record a resident leaving: the termination date and the day the keys came back | `/departure` |
| record the agreed resale value or an independent valuation for a departed resident's unit | `/valuation` |
| record a refurbishment starting, finishing or its cost | `/refurb` |
| record a unit going on the market at an asking price | `/advertise` |
| every unit between residents: the stage it is at, days empty and the fees not coming in | `/vacancies` |
| settle a new resident into a unit: the contract, the residents, the ingoing and the terms | `/move-in` |
| record an exit entitlement paid out | `/exit-paid` |
| record that the written exit statement was given | `/statement` |
| bill the month's weekly fees for every contract, with former residents charged only the share the rules allow | `/fee-run` |
| residents behind on their weekly fees | `/arrears` |
| record a fee payment | `/paid` |
| open maintenance requests against their target dates | `/maintenance` |
| log a maintenance request for a unit or the common areas | `/request` |
| close a maintenance request with its cost | `/done` |
| prospective residents and where each one is up to | `/enquiries` |
| add a new prospective resident | `/enquiry` |
| record a conversation with a prospect and the next step | `/contact` |
| aGM dates for every village: the year end, the deadline and the last meeting held | `/agm` |
| record an AGM, special general meeting, residents committee meeting or budget meeting | `/meeting` |
| check the records against the retirement village rules in docs/compliance.md (NSW exit orders and the 42-day cap, Queensland buy-back and shared charges, the NZ AGM) and report what is late or about to be | `/compliance` |
| answer one or all of the ten questions across the records | `/insights` |
| draft the written statement of how a former resident's exit entitlement was worked out | `/draft-exit-statement` |
| draft an update to a former resident's family or executor: refurbishment, advertising, sale and the expected exit payment | `/draft-family-update` |
| draft a kind reminder to a resident behind on fees | `/draft-arrears` |
| draft a follow-up to a prospective resident with the units coming available | `/draft-enquiry` |
| draft the notice and agenda for a village's annual general meeting | `/draft-agm-notice` |
| add a note to a unit (and its latest contract) | `/log` |
| add a record of any kind: a village, unit, resident, meeting | `/add` |
| change fields on any record, or a setting | `/update` |
| bring residents and units across from a Centrim Life resident list, then contract terms from the finance system, saved as CSV | `/import` |
| write every record to one JSON file | `/export` |
| render exit entitlement statements, fee statements and AGM packs as branded HTML | `/documents` |
| render the read-only dashboards: the week, empty units, money owed both ways and record checks | `/view` |
| make this system yours in plain language | `/customise` |
| add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view` | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run village -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Money owed to a former resident or their estate is never estimated aloud as final. Say which figures are recorded and which are waiting (agreed value, refurbishment cost, resale).
- Resident records are personal information. Do not paste them anywhere outside this database and `drafts/`.
- The record checks are not legal advice. Cite the rule from `docs/compliance.md`; if it looks out of date, say so and stop.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Centrim Life.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/centrim-life
