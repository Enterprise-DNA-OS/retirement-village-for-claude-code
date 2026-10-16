// npm test: a temporary embedded database (or an isolated schema on TEST_DATABASE_URL),
// migrate, seed twice, then every command, rule boundary, import, draft, document and view.
// Never touches your data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { execute, human, insightQueries } from './village.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'retirement-village-smoke-'));
const postgresUrl = process.env.TEST_DATABASE_URL || '';
let control, schema;
if (postgresUrl) {
  const { default: pg } = await import('pg');
  control = new pg.Client({ connectionString: postgresUrl }); await control.connect();
  schema = 'village_test_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8);
  await control.query(`create schema ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema},public`;
}
process.env.DATABASE_URL = postgresUrl; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
const db = await getDb();
let checks = 0;
const run = (...args) => execute(db, args);
const ok = (condition, message) => { assert.ok(condition, message); console.log(`ok ${++checks}: ${message}`); };
const fail = async (args, pattern) => { await assert.rejects(() => run(...args), pattern); ok(true, `Rejects: ${args.slice(0, 3).join(' ')} (${pattern.source})`); };
const count = async (t, where = 'true') => Number((await db.query(`select count(*) as n from ${t} where ${where}`))[0].n);
const findings = async (rule) => (await run('compliance')).filter((x) => x.rule === rule);
const attention = async (item) => (await run('attention')).filter((x) => x.item === item);
const one = async (sql, params = []) => (await db.query(sql, params))[0];
const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const pct = async (contract, on) => Number((await one(`select resident_fee_pct(c.id,$2::date) as p from contracts c where c.number=$1`, [contract, on])).p);

try {
  ok((await migrate(db)).ran.length === 1, 'Migration applies');
  ok((await migrate(db)).ran.length === 0, 'Migration is idempotent');
  await seed(db);
  const before = { contracts: await count('contracts'), charges: await count('charges'), meetings: await count('meetings') };
  await seed(db);
  ok(before.charges > 100 && (await count('charges')) === before.charges && (await count('contracts')) === before.contracts && (await count('meetings')) === before.meetings, 'Seed is idempotent');

  // Every read
  for (const c of ['help', 'villages', 'units', 'residents', 'contracts', 'vacancies', 'exits', 'resales', 'charges', 'arrears', 'maintenance', 'enquiries', 'meetings', 'agm', 'occupancy',
    'compliance', 'attention', 'settings'])
    ok(Boolean(await run(c)), `Read ${c}`);
  ok((await run('units', '--village=banksia')).every((r) => r.village === 'BR'), 'Village filter on reads');
  ok((await run('occupancy')).find((r) => r.village === 'KG').occupied === 7, 'Occupancy counts the units with someone living in them');
  const kg = await run('village', 'KG');
  ok(kg.units.length === 8 && kg.exits_owed.length === 1 && kg.attention.length > 0, 'Village detail: units, exits owed, attention');
  ok((await run('unit', 'KG-08')).contracts.length === 2, 'Unit detail shows every occupancy');
  ok((await run('contract', 'PP-0201')).exit.state === 'on the market', 'Contract detail carries the exit working');
  ok((await run('resident', 'judith')).contract.unit === 'BR-01', 'Resident detail finds their unit');

  // Name matching
  ok((await run('show', 'villages', 'PANDANUS POINT')).code === 'PP', 'Case-insensitive name match');
  ok((await run('show', 'residents', 'whitfield')).name === 'Joan Whitfield', 'Name fragment match');
  await fail(['show', 'contracts', 'KG-02'], /Ambiguous contracts/);
  await fail(['show', 'units', 'nothing-like-this'], /No units match/);

  // Attention: one of each kind in the seed
  for (const item of ['EXIT DUE', 'MAINTENANCE OVERDUE', 'FEES OVERDUE', 'REFURB SLOW', 'UNIT NOT LISTED', 'ENQUIRY QUIET', 'RULE NSW-CHARGE-CAP', 'RULE QLD-SHARED-CHARGES',
    'RULE NSW-AGREED-VALUATION', 'RULE QLD-RESALE-VALUE', 'RULE QLD-EXIT-STATEMENT', 'RULE NZ-AGM'])
    ok((await attention(item)).length > 0, `Attention finds ${item}`);
  const firstItem = (await run('attention'))[0].item;
  ok(firstItem === 'EXIT DUE' || firstItem.startsWith('RULE'), 'Exit money and rule dates lead the attention list');

  // Every rule has seeded evidence, a source and a doc entry
  const rules = ['NSW-EXIT-ORDER', 'NSW-AGREED-VALUATION', 'NSW-CHARGE-CAP', 'QLD-BUYBACK', 'QLD-SHARED-CHARGES', 'QLD-RESALE-VALUE', 'QLD-EXIT-STATEMENT', 'NZ-AGM'];
  const all = await run('compliance');
  ok(rules.every((r) => all.some((x) => x.rule === r)), 'Every compliance rule has seeded evidence');
  ok(all.every((x) => x.source), 'Every finding carries its source');
  const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'compliance.md'), 'utf8');
  ok(rules.every((r) => doc.includes(`## ${r}`)), 'Every rule is documented in docs/compliance.md');

  // The exit sum: ingoing less DMF plus gain share less refurbishment share less unpaid fees
  const pp2 = await run('exit', 'PP-0201');
  const w = Object.fromEntries(pp2.working.map((x) => [x.line, x.amount]));
  ok(Math.abs(w['Ingoing contribution'] + w['Less deferred management fee'] + w['Plus share of capital gain'] + w['Less share of refurbishment'] + w['Less unpaid fees'] - w['Exit entitlement']) <= 2, 'Exit working adds up');
  ok(w['Less deferred management fee'] === -156000, 'QLD resale-based DMF: 30% cap of the agreed resale value 520,000');
  ok(w['Plus share of capital gain'] === 47600, 'Resident takes 70% of the 68,000 gain');
  const kg7 = await run('exit', 'KG-0701');
  ok(kg7.working[1].amount === -129300 && !kg7.dates.pay_by, 'NZ: 30% of the ingoing after 8.8 years, paid on relicensing (no date until then)');
  await fail(['exit', 'KG-0101'], /has not ended/);

  // NSW fees after leaving: 42 days in full, then the capital gain share (registered) or nothing
  const br3 = await one(`select vacated_on from contracts where number='BR-0301'`);
  const plus = (d, n) => new Date(Date.parse(d) + n * 86400e3).toISOString().slice(0, 10);
  ok(await pct('BR-0301', plus(br3.vacated_on, 41)) === 100, 'NSW: day 41 after leaving is billed in full');
  ok(await pct('BR-0301', plus(br3.vacated_on, 42)) === 50, 'NSW registered interest: from day 42 the resident pays their 50% gain share');
  await db.query(`update contracts set registered_interest=false where number='BR-0301'`);
  ok(await pct('BR-0301', plus(br3.vacated_on, 42)) === 0, 'NSW without a registered interest: nothing after 42 days');
  await db.query(`update contracts set registered_interest=true where number='BR-0301'`);

  // QLD: 90 days in full, then the resale share until 9 months, then nothing
  const pp4 = await one(`select vacated_on from contracts where number='PP-0401'`);
  const months9 = (await one(`select ($1::date + interval '9 months')::date as d`, [pp4.vacated_on])).d;
  ok(await pct('PP-0401', plus(pp4.vacated_on, 89)) === 100 && await pct('PP-0401', plus(pp4.vacated_on, 90)) === 70, 'QLD: 89 days in full, from day 90 the 70% share');
  ok(await pct('PP-0401', plus(months9, -1)) === 70 && await pct('PP-0401', months9) === 0, 'QLD: the day before 9 months is shared, 9 months on the operator pays');
  ok(await pct('KG-0701', day(0)) === 100, 'NZ: fees continue under the contract until the unit is relicensed');

  // The bill run applies the rules itself, and never double-bills
  const nextMonth = day(35).slice(0, 7);
  const dry = await run('bill', `--month=${nextMonth}`, '--dry-run');
  ok(dry.charges > 15 && dry.dry_run && !(await count('charges', `number like '%-${nextMonth}'`)), 'Bill dry run makes nothing');
  const bill = await run('bill', `--month=${nextMonth}`);
  ok(bill.charges === dry.charges && bill.sent === false, 'Bill run creates one charge per contract and sends nothing');
  const br3Line = bill.lines.find((l) => l.contract === 'BR-0301');
  ok(br3Line && Number(br3Line.billed) * 2 - Number(br3Line.full) <= 0.02, 'Bill run charges a NSW former resident only their 50% after 42 days');
  ok(!bill.lines.some((l) => l.contract === 'PP-0201'), 'Bill run charges a QLD former resident nothing after 9 months');
  ok(!bill.lines.some((l) => l.contract === 'PP-0701'), 'Bill run skips a contract whose exit is paid');
  ok((await run('bill', `--month=${nextMonth}`)).charges === 0, 'A second bill run for the same month adds nothing');
  ok(!(await findings('NSW-CHARGE-CAP')).some((x) => x.record.endsWith(nextMonth)), 'What the bill run charges passes the cap check');
  await fail(['bill', '--month=2026-13'], /not YYYY-MM/);

  // NSW exit order: the clock starts 40 days after the earliest of advertising, keys back, stay notice
  const order = await one(`select nsw_clock_starts,nsw_order_from,first_advertised_on,vacated_on from v_exits where contract='BR-0301'`);
  const earliest = [order.first_advertised_on, order.vacated_on].sort()[0];
  ok(order.nsw_clock_starts === plus(earliest, 40), 'NSW order clock starts 40 days after the earliest trigger');
  ok(order.nsw_order_from === (await one(`select ($1::date + interval '6 months')::date as d`, [order.nsw_clock_starts])).d, 'Hornsby is metropolitan: 6 months');
  await db.query(`update villages set metro=false where code='BR'`);
  ok((await one(`select nsw_order_from from v_exits where contract='BR-0301'`)).nsw_order_from === (await one(`select ($1::date + interval '12 months')::date as d`, [order.nsw_clock_starts])).d, 'Outside the metropolitan list: 12 months');
  await db.query(`update villages set metro=true where code='BR'`);
  ok((await findings('NSW-EXIT-ORDER')).some((x) => x.record === 'BR-0301'), 'Unpaid NSW exit past the order date is flagged');
  await run('valuation', 'BR-0301', '--amount=820000', '--agreed', `--on=${day(0)}`);
  ok(!(await findings('NSW-AGREED-VALUATION')).length, 'Recording the agreed valuation clears that finding');
  ok((await run('exit', 'BR-0301')).working[2].amount === 104000, 'Agreed value 820,000 over a 612,000 ingoing gives a 104,000 half share');

  // QLD buy-back: 18 months after termination
  const pp2Row = await one(`select ended_on from contracts where number='PP-0201'`);
  ok(pp2.dates.pay_by === (await one(`select ($1::date + interval '18 months')::date as d`, [pp2Row.ended_on])).d, 'QLD buy-back date is 18 months after termination');
  ok((await findings('QLD-BUYBACK')).some((x) => x.record === 'PP-0201'), 'QLD buy-back inside the warning window is flagged');
  await run('valuation', 'PP-0501', '--amount=430000');
  ok(!(await findings('QLD-RESALE-VALUE')).length, 'A valuation clears the QLD resale value finding');

  // NZ AGM: recording it clears the finding; a late one is still reported
  const agm = await one(`select agm_by,year_end from v_agm where village='KG'`);
  await run('meeting', 'KG', '--kind=AGM', `--on=${agm.agm_by}`);
  ok(!(await findings('NZ-AGM')).length, 'AGM on the last allowed day is in time');
  await db.query(`delete from meetings where kind='AGM' and held_on=$1`, [agm.agm_by]);
  await run('meeting', 'KG', '--kind=AGM', `--on=${plus(agm.agm_by, 1)}`);
  ok((await findings('NZ-AGM')).some((x) => /after the/.test(x.finding)), 'AGM a day late is reported as late');
  await fail(['meeting', 'KG', '--kind=picnic', '--on=2026-01-01'], /--kind must be/);

  // A full turnover: leave, value, refurbish, advertise, move in, pay out with the statement
  await fail(['move-in', 'KG-01', '--contract=X', '--residents=A', '--ingoing=1', `--on=${day(0)}`], /still has contract/);
  const left = await run('leave', 'KG-0601', `--ended=${day(-10)}`, `--vacated=${day(-5)}`);
  ok(left.vacated_on === day(-5) && left.exit_estimate > 0, 'Leave records the departure and estimates the exit');
  ok((await run('vacancies')).some((r) => r.unit === 'KG-06' && r.stage === 'awaiting refurbishment'), 'The unit shows as empty, awaiting refurbishment');
  await run('refurb', 'KG-06', `--start=${day(-4)}`);
  await run('refurb', 'KG-06', `--done=${day(-1)}`, '--cost=12000');
  const adv = await run('advertise', 'KG-06', '--price=440000');
  ok(adv.first_advertised_on === day(0) && Number(adv.asking_cents) === 44000000, 'Advertise records the asking price');
  const moved = await run('move-in', 'KG-06', '--contract=KG-0602', '--residents=Alice Rua; Tame Rua', '--ingoing=440000', `--on=${day(0)}`, '--enquiry=Hemi');
  ok(moved.residents.length === 2 && moved.terms.dmf === 10 && moved.warnings.some((x) => /Resale of KG-06 closed/.test(x)), 'Move in creates the contract, two residents, the old terms, and closes the resale');
  ok((await run('show', 'enquiries', 'hemi')).stage === 'moved in', 'Move in marks the enquiry moved in');
  ok((await run('exit', 'KG-0601')).dates.pay_by === day(14), 'Exit becomes payable 14 days after the next resident settles');
  const paid = await run('exit-paid', 'KG-0601');
  ok(paid.warnings.length === 1 && Number(paid.exit_paid_cents) > 0, 'Paying out warns when no written statement is recorded');
  ok((await run('statement', 'KG-0601')).exit_statement_on === day(0), 'Statement records the written exit statement');
  await fail(['exit-paid', 'KG-0601'], /was paid/);
  await fail(['leave', 'KG-0101', '--ended=1990-01-01'], /cannot end before/);
  await fail(['refurb', 'KG-01', '--start=2026-01-01'], /no departure on record/);

  // QLD exit statement
  await run('statement', 'PP-0701', `--on=${day(-31)}`);
  ok(!(await findings('QLD-EXIT-STATEMENT')).length, 'Recording the QLD exit statement clears it');

  // Fees, maintenance, enquiries
  const arrear = (await run('arrears')).find((r) => r.residents === 'Ann Kowalski');
  await run('paid', arrear.charge);
  await fail(['paid', arrear.charge], /was paid/);
  const req = await run('request', 'BR-04', 'Smoke alarm chirping', '--priority=urgent', '--by=Ray Delaney');
  ok(req.state === 'open' && req.target_on === day(1), 'A new urgent request is due tomorrow');
  ok((await run('request', 'banksia', 'Bus shelter roof leaking')).unit === null, 'A request against the village has no unit');
  await fail(['request', 'BR-04', 'x', '--priority=soon'], /--priority/);
  ok((await run('done', 'MR-1001', '--cost=1450')).done_on === day(0), 'Done closes a request with its cost');
  ok(!(await attention('MAINTENANCE OVERDUE')).some((x) => x.record === 'MR-1001'), 'A done request leaves attention');
  const enq = await run('enquiry', 'Gwen Torres', '--village=PP', '--wants=2 bedroom villa', '--source=website', '--next=Send brochure', `--next-on=${day(2)}`);
  ok(enq.stage === 'enquiry', 'Enquiry adds a prospect');
  ok((await run('contact', 'Bill Sanders', '--stage=application', '--next=Deposit form', `--next-on=${day(3)}`)).stage === 'application', 'Contact moves the enquiry on');
  ok(!(await attention('ENQUIRY QUIET')).some((x) => x.record === 'Bill Sanders'), 'A contacted enquiry is no longer quiet');
  ok((await run('contact', 'Gwen', '--lost=Moving to Perth')).stage === 'lost', 'Contact can record a lost enquiry');
  ok((await run('log', 'PP-02', 'Board approved the buy-back funding')).body.includes('buy-back'), 'Log writes a note to the unit');

  // Generic add and update, money in dollars
  const unit = await run('add', 'units', '--village_id=PP', '--code=PP-09', '--kind=studio', '--weekly_fee=131.50');
  ok(unit.weekly_fee_cents === 13150, 'Add takes dollars for a cents field');
  ok((await run('update', 'settings', '1', '--warn_days=60')).warn_days === 60, 'Settings change through update');
  await fail(['add', 'units', '--colour=red'], /no field colour/);

  // Insights
  const ins = await run('insights');
  ok(ins.length === insightQueries.length && insightQueries.length === 10, 'Ten questions');
  ok(ins.every((q) => Array.isArray(q.rows) && q.rows.length > 0), 'Every question has an answer on the demo data');

  // Imports
  const resFile = path.join(REPO_ROOT, 'examples', 'centrim-life', 'residents.csv');
  const termsFile = path.join(REPO_ROOT, 'examples', 'centrim-life', 'contracts.csv');
  const dryImport = await run('import', 'centrim', `--file=${resFile}`, '--dry-run');
  ok(dryImport.created === 4 && !(await count('units', `code='KG-K21'`)), 'Import dry run reads every row and keeps nothing');
  const imp = await run('import', 'centrim', `--file=${resFile}`);
  ok(imp.created === 4 && imp.units_added === 3 && imp.contracts_added === 3 && imp.warnings.length === 1, 'Import adds units, one contract per unit, a couple on one contract, and warns terms are missing');
  ok((await run('contract', 'KG-K21-2019')).residents.length === 2, 'A couple shares one imported contract');
  ok((await run('import', 'centrim', `--file=${resFile}`)).updated === 4 && (await count('residents', `name='Joyce Harper'`)) === 1, 'Import again updates, never duplicates');
  const terms = await run('import', 'terms', `--file=${termsFile}`);
  ok(terms.updated === 3 && Number((await one(`select ingoing_cents from contracts where number='KG-K21-2019'`)).ingoing_cents) === 49800000, 'Terms import sets the ingoing, DMF and fee');
  const bad = path.join(temp, 'bad.csv'); fs.writeFileSync(bad, 'Village,Unit No,First Name,Last Name\nNowhere Village,1,A,B\n');
  await fail(['import', 'centrim', `--file=${bad}`], /not set up/);
  await fail(['import', 'centrim', '--file=residents.xlsx'], /Save the report from Excel as CSV/);
  await fail(['import', 'pdf', `--file=${bad}`], /Supported imports/);

  // Drafts never send
  for (const [cmd, arg] of [['weekly-review'], ['draft-exit-statement', 'PP-0201'], ['draft-family-update', 'KG-0701'], ['draft-arrears', 'KG-0301'], ['draft-enquiry', 'Wendy'], ['draft-agm-notice', 'KG']]) {
    const d = await run(...[cmd, arg].filter(Boolean));
    ok(d.sent === false && fs.existsSync(d.file) && /Nothing has been sent|Draft only/.test(fs.readFileSync(d.file, 'utf8')), `${cmd} writes a draft and sends nothing`);
  }
  ok(/No interest is charged/.test(fs.readFileSync((await run('draft-exit-statement', 'PP-0201')).file, 'utf8')), 'QLD exit statement says no interest is charged after 90 days');
  await fail(['draft-arrears', 'KG-0101'], /no overdue fees/);

  // Human output and export
  ok(human(await run('attention')).includes('EXIT DUE'), 'Human table output');
  const backup = await run('export', `--out=${path.join(temp, 'backup.json')}`);
  ok(backup.counts.contracts >= 30 && JSON.parse(fs.readFileSync(backup.file, 'utf8')).format === 'retirement-village-for-claude-code/v1', 'Export writes every record');
  await fail(['export', `--out=${backup.file}`], /EEXIST/);
  await fail(['nonsense'], /Unknown command/);

  // Documents and views render from the same database (PGlite only: they open their own connection)
  if (!postgresUrl) {
    await db.close();
    const env = { ...process.env };
    const docs = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'docs.mjs')], { cwd: temp, env, encoding: 'utf8' });
    ok(docs.status === 0 && /document\(s\) rendered/.test(docs.stdout) && Number(docs.stdout.match(/(\d+) document/)[1]) >= 10, `npm run docs renders the paperwork (${docs.stdout.match(/(\d+) document/)?.[1]} documents)`);
    const view = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'view.mjs')], { cwd: temp, env, encoding: 'utf8' });
    ok(view.status === 0 && (view.stdout.match(/view:/g) || []).length >= 4, 'npm run view renders every dashboard');
    const cli = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'village.mjs'), 'exits', '--json'], { cwd: temp, env, encoding: 'utf8' });
    ok(cli.status === 0 && Array.isArray(JSON.parse(cli.stdout)), 'The CLI answers --json from the command line');
    const amb = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'village.mjs'), 'show', 'contracts', 'KG-02'], { cwd: temp, env, encoding: 'utf8' });
    ok(amb.status === 1 && /Ambiguous/.test(amb.stderr), 'An ambiguous name lists the candidates and exits 1');
  }

  console.log(`PASS ${checks} checks`);
} finally {
  try { await db.close(); } catch {}
  if (control) { await control.query(`drop schema ${schema} cascade`); await control.end(); }
  fs.rmSync(temp, { recursive: true, force: true });
}
