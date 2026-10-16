# Why there is no front end

Centrim Life is a set of screens over resident, unit and maintenance records. The records underneath are ordinary: villages, units, residents, contracts, fees, requests, meetings. What you pay for is the layer on top that lets staff get at them without writing a query. Screens, filters, dashboards, forms.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, describe what you want, and it writes the query, runs it, and explains the answer. Ask a question the dashboard never had a chart for (what an empty villa has cost in fees since the keys came back, which enquiry sources turn into residents) and you still get an answer.

## What you gain

- **Better answers.** A dashboard shows what the vendor decided to chart. Here you ask your own question, in your own words, against your own records.
- **The money side in the same place.** Exit entitlements, deferred management fees and the rules on fees after leaving sit beside the resident records, not in a second system.
- **No seats.** Every village manager, accounts and sales person can look. The bill does not grow with headcount or villages.
- **Your data in your Postgres.** Plain tables. Back them up, query them from anything, leave any time.

## What you give up

- **A resident app.** Centrim Life gives residents an app for messages, activities and dining orders. This has none; residents do not log in.
- **Kiosks and tablets.** Visitor sign-in at the front door and dining orders on a tablet need a screen.
- **A visual board.** Maintenance and enquiries are lists you ask about, not cards you drag.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for operators who want someone to call.

Enterprise DNA builds the screens an operator needs on top of the same database when they matter: a resident page, a visitor sign-in, a maintenance form for staff.

## Who this fits

Operators whose office staff spend their week on exits, resales, fees, maintenance and enquiries, and who would rather ask than click. If your residents live in the app, keep it for them and run the office from here.

Installed and run for you: https://enterprisedna.co/omni/instead-of/centrim-life
