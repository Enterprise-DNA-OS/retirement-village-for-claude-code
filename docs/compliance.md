# Record checks

`/compliance` (or `npm run village -- compliance`) checks the records against the rules below. Each rule says where it comes from, what the check looks for, and what it cannot see. The periods sit in the `settings` table, so you can change them without touching code.

This is a record check, not legal advice. A clean result means the records show no gap against these rules. It does not mean the village complies: the check only sees what was recorded. Read the source before relying on any rule, and ask `/customise` to change one when your lawyer, regulator or the law says otherwise. Your contracts can be more generous than the Act; the check uses the statutory floor.

Sources were checked on 16 October 2026. Each village carries its `jurisdiction` (NZ, NSW, QLD, VIC, SA, WA, TAS, ACT, NT); rules run only for the villages they apply to. Victoria, South Australia, Western Australia and the territories have no checks yet: add yours with `/customise`.

## Fees after a resident leaves

The `resident_fee_pct(contract, date)` function in the database is the one place that says what share of a fee period a former resident may be billed. The bill run (`bill --month=`) uses it, so what it creates passes the checks below. The checks catch anything billed by hand or brought across from an old system.

- **NSW:** 100% for the first 42 days after permanently leaving; after that the resident's capital gain share for a registered interest holder who shares in the gain, otherwise nothing.
- **QLD:** 100% for the first 90 days after vacating; from 90 days to 9 months the share in which the resident shares the resale ingoing contribution (`resident_share_pct`); nothing after 9 months.
- **Everywhere else, including New Zealand:** 100% until the next resident settles, unless the contract says otherwise. Change it in the function through `/customise` if your contracts stop fees earlier.

A fee period is checked on the day it starts. A period that straddles a boundary (day 42, day 90, 9 months) should be split; the bill run starts each period on the first of the month, so a manual split is a `/customise` away if you need it to the day.

## NSW-EXIT-ORDER

- **Source:** Retirement Villages Act 1999 (NSW), exit entitlement orders ([nsw.gov.au](https://www.nsw.gov.au/housing-and-construction/aged-care-retirement-villages/leaving-a-retirement-village/exit-entitlement-orders)).
- **The rule:** a former resident who is a registered interest holder can apply for an order to be paid their exit entitlement once the unit is unsold after 6 months in a metropolitan local government area or 12 months elsewhere. The period starts 40 days after the earliest of: the unit first advertised for sale, the resident permanently leaving and returning all keys, or the resident giving written notice they will stay while it is for sale.
- **What the check flags:** an unpaid exit for a registered interest holder whose order date is within `warn_days` (45) or past.
- **Settings:** `nsw_clock_start_days` (40), `nsw_metro_months` (6), `nsw_other_months` (12). Set `metro` on the village when its council is on the metropolitan list (the Sydney councils and Newcastle; Wollongong is not on it).
- **What it cannot see:** an alternative period the Commissioner has approved for your village, an extension request, or whether the operator delayed the sale unreasonably.

## NSW-AGREED-VALUATION

- **Source:** the same page: an application must include an agreed valuation made at least 30 days before it.
- **What the check flags:** an unpaid registered interest exit with no agreed value recorded once the date 30 days before its order date is within `warn_days`.
- **What it cannot see:** a valuation recorded outside this system. Record it: `valuation <contract> --amount= --agreed`.

## NSW-CHARGE-CAP

- **Source:** Retirement Villages Act 1999 (NSW) section 152, recurrent charges in respect of general services for registered interest holders, and the cap for other residents ([nsw.gov.au](https://www.nsw.gov.au/housing-and-construction/aged-care-retirement-villages/leaving-a-retirement-village/registered-interest-holders)).
- **The rule:** a former resident pays general services charges for at most 42 days after permanently leaving (possessions out and keys back). After that a registered interest holder who shares in the capital gain shares the charges in the same proportion; the period ends sooner if the unit sells, a new resident moves in or the contract says so.
- **What the check flags:** a fee period starting after the resident left where the amount billed is more than a dollar over the share `resident_fee_pct` allows.
- **Settings:** `nsw_charge_cap_days` (42).
- **What it cannot see:** an earlier end date written in the contract. Trust villages held for residents are exempt: turn the check off for them with `/customise`.

## QLD-BUYBACK

- **Source:** Retirement Villages Act 1999 (Qld) section 63 ([business.qld.gov.au](https://www.business.qld.gov.au/industries/service-industries-professionals/service-industries/operating-retirement-village/residents-leaving)).
- **The rule:** the exit entitlement is paid by the earliest of the date in the contract, 14 days after the resale settles, or 18 months after the termination date when the unit has not sold (or a later date the tribunal fixes).
- **What the check flags:** an unpaid exit whose date is within `warn_days` or past.
- **Settings:** `qld_buyback_months` (18), `pay_after_resale_days` (14).
- **What it cannot see:** an earlier date in the contract, or a tribunal order extending the date.

## QLD-SHARED-CHARGES

- **Source:** Retirement Villages Act 1999 (Qld) section 104, as described on [business.qld.gov.au](https://www.business.qld.gov.au/industries/service-industries-professionals/service-industries/operating-retirement-village/residents-leaving).
- **The rule:** the former resident pays general services charges and maintenance reserve fund contributions in full for 90 days after vacating unless the unit sells sooner; from 90 days to 9 months the operator and the resident share them in the proportion they share the resale ingoing contribution; after 9 months the operator pays. No interest can be charged on accrued amounts.
- **What the check flags:** a fee period starting after the resident left billed more than the share allowed on its first day.
- **Settings:** `qld_full_charge_days` (90), `qld_shared_charge_months` (9).

## QLD-RESALE-VALUE

- **Source:** [business.qld.gov.au](https://www.business.qld.gov.au/industries/service-industries-professionals/service-industries/operating-retirement-village/residents-leaving), residents leaving: the parties agree the resale value in writing within 30 days after the right to reside ends; failing that a valuer is engaged within 14 days and the valuation is taken to be the agreed value.
- **What the check flags:** an unpaid QLD exit with neither an agreed value nor a valuation recorded once 30 days after termination is within 14 days or past.
- **Settings:** `qld_resale_value_days` (30).

## QLD-EXIT-STATEMENT

- **Source:** the same page: when the exit entitlement is paid, the operator gives a written statement showing how it was worked out, including the exit fee and how it was calculated, accrued charges and the resident's percentage share.
- **What the check flags:** a QLD exit recorded as paid with no `exit_statement_on` date.
- **The document:** `npm run docs -- exit-statement` renders one per departure from the same figures, in your brand. Record it once given: `statement <contract>`.

## NZ-AGM

- **Source:** Retirement Villages Code of Practice 2008, clause 26(1), and Retirement Villages (General) Regulations 2006, regulation 10; summarised in the Registrar's practice note ([companiesoffice.govt.nz](https://www.companiesoffice.govt.nz/assets/companies-office/retirement-villages/retirement-villages-practice-note-covid19-restrictions.pdf)).
- **The rule:** the operator holds an annual general meeting of residents within six months of the end of the village's most recently completed financial year, to receive the financial statements, the statutory supervisor's report and the maintenance report.
- **What the check flags:** no AGM recorded since the last year end once its deadline is within `warn_days` or past, or an AGM held after the deadline.
- **Settings:** `nz_agm_months` (6). Each village's `year_end_month` sets its financial year.
- **What it cannot see:** the meeting's notice and agenda. `draft-agm-notice <village>` drafts one.

## Coming in New Zealand, not yet law

On 4 December 2025 the Government announced changes to the Retirement Villages Act 2003: repayment no later than 12 months after a unit is vacated, interest after six months, and weekly fees and the deferred management fee stopping when a resident vacates, for occupation right agreements signed one year after the Bill passes. As at 16 October 2026 these are not law, so no check runs for them. When they pass, `/customise` adds an NZ branch to `resident_fee_pct` and an NZ buy-back rule beside QLD-BUYBACK.
