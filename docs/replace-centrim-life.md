# Moving off Centrim Life

Centrim Life keeps resident and property records, maintenance, communications, dining, feedback and visitor management for retirement living villages (personcentredsoftware.com, checked 16 October 2026). It does not publish an export guide or its column names. The way across is the resident list as a spreadsheet: ask your Centrim Life account contact, or run the resident report your login offers, and save it from Excel as CSV.

The money side of a village (ingoing contributions, deferred management fee terms, weekly fees) is usually in your finance system or a contract register, not in Centrim Life. That comes across in a second file.

The import reads the common labels listed below. If yours differ, rename the header row in the spreadsheet, or ask `/customise` to add your labels to `COLUMNS` in `scripts/village.mjs`.

## Before you import

1. Add each village with its jurisdiction, so the right rules run: `add villages --code=KG --name="Kowhai Grove" --jurisdiction=NZ --currency=NZD --year_end_month=3`. For NSW set `--council=` and `--metro=true` when the council is on the metropolitan list.
2. Set the business name: `update settings 1 --business_name="Harbourview Living"`.

## Residents and units

One row per resident. A couple in the same unit is two rows; they become one contract with two residents.

```bash
npm run village -- import centrim --file=residents.csv --dry-run
npm run village -- import centrim --file=residents.csv
npm run village -- import centrim --file=kowhai.csv --village=KG     # a list for one village with no village column
```

| Here | Column labels read |
|---|---|
| Village | Village, Site, Community, Location, Facility |
| Unit | Unit, Unit No, Unit Number, Unit No., Property, Apartment, Villa |
| Unit type | Unit Type, Property Type, Type, Accommodation Type |
| Bedrooms | Bedrooms, Beds, No. Bedrooms |
| Resident | Resident, Resident Name, Name, Full Name, or First Name and Last Name (Given Name, Preferred Name, Surname, Family Name) |
| Email, phone | Email, Email Address, E-mail; Phone, Mobile, Phone Number, Contact Number, Home Phone |
| Date of birth | Date of Birth, DOB, Birth Date, Birthday |
| Move-in date | Move In Date, Move-in Date, Moved In, Entry Date, Occupancy Start, Start Date, Settlement Date |
| Next of kin | Next of Kin, Emergency Contact, NOK Name, Next of Kin Name, Emergency Contact Name; and their phone |
| Contract number | Contract, Contract No, Contract Number, Agreement, ORA Number, Lease Number, Agreement No |

- Unit codes are prefixed with the village code when they are not already (`K21` at Kowhai Grove becomes `KG-K21`).
- A unit with no current contract gets one, settled on the move-in date. A unit that already has one gets the resident added to it.
- The import matches residents on name within the contract, so running it again updates contact details and never duplicates.
- Dates are read as YYYY-MM-DD or DD/MM/YYYY.

## Contract terms

From your finance system or contract register, one row per unit or contract:

```bash
npm run village -- import terms --file=contracts.csv --dry-run
npm run village -- import terms --file=contracts.csv
```

| Here | Column labels read |
|---|---|
| Contract or unit | Contract (any label above), or Unit |
| Ingoing contribution | Ingoing, Ingoing Contribution, Entry Payment, Capital Sum, Purchase Price, Licence Payment |
| DMF a year | DMF % per year, DMF Rate, DMF per year, Exit Fee Rate, DMF % |
| DMF cap | DMF Cap, DMF Max, Maximum DMF, Exit Fee Cap, DMF Cap % |
| DMF base | DMF Base, DMF Calculated On, Exit Fee Base (a value containing "resale" or "sale" means the resale price; anything else the ingoing) |
| Resident share | Capital Gain Share, Resident Share, Resident Share %, Capital Gain % |
| Weekly fee | Weekly Fee, Weekly Fees, Service Fee, General Services Charge, Weekly Service Fee |

After the residents import, the CLI warns how many current contracts still have no terms. Run the terms import until that is zero.

## What does not come across in this version

- Maintenance history, messages, activities, dining orders, feedback and visitor logs. Keep Centrim Life read-only for the history, or ask Enterprise DNA to bring the maintenance log across.
- Former residents and past resales. Add the departures still owed money by hand (`add contracts`, then `leave`), so their exit dates and checks run from day one.
- Documents and photos stored against residents.

## Check it

```bash
npm run village -- occupancy
npm run village -- units --village=KG
npm run village -- attention
```

Then run the first fee run as a dry run (`bill --month=YYYY-MM --dry-run`) and compare the total with last month's from your finance system.
