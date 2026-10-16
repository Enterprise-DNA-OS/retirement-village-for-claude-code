#!/usr/bin/env node
// One CLI for the retirement village database. Human tables by default, --json for machines.
//   node scripts/village.mjs help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';

// Writable fields per record kind. Anything else is rejected.
export const entities = {
  villages: ['code', 'name', 'jurisdiction', 'council', 'metro', 'currency', 'year_end_month', 'manager', 'statutory_supervisor', 'registered_on'],
  units: ['village_id', 'code', 'kind', 'bedrooms', 'weekly_fee_cents', 'list_price_cents'],
  contracts: ['unit_id', 'number', 'kind', 'registered_interest', 'signed_on', 'settled_on', 'ingoing_cents', 'dmf_pct_per_year', 'dmf_cap_pct', 'dmf_base', 'resident_share_pct',
    'refurb_share_pct', 'weekly_fee_cents', 'ended_on', 'vacated_on', 'stay_notice_on', 'exit_statement_on', 'exit_paid_on', 'exit_paid_cents', 'external_id'],
  residents: ['contract_id', 'name', 'email', 'phone', 'born_on', 'next_of_kin', 'next_of_kin_phone', 'moved_out_on', 'note', 'external_id'],
  charges: ['contract_id', 'number', 'kind', 'period_start', 'period_end', 'full_cents', 'billed_cents', 'due_on', 'paid_on', 'note'],
  maintenance: ['number', 'village_id', 'unit_id', 'reported_by', 'reported_on', 'category', 'priority', 'description', 'assigned_to', 'done_on', 'cost_cents', 'resident_pays'],
  enquiries: ['name', 'email', 'phone', 'village_id', 'wants', 'source', 'stage', 'first_contact_on', 'last_contact_on', 'next_step', 'next_step_on', 'lost_reason', 'contract_id'],
  meetings: ['village_id', 'kind', 'held_on', 'notice_given_on', 'note'],
  notes: ['village_id', 'unit_id', 'contract_id', 'title', 'body'],
  settings: ['business_name', 'nsw_clock_start_days', 'nsw_metro_months', 'nsw_other_months', 'nsw_charge_cap_days', 'qld_full_charge_days', 'qld_shared_charge_months', 'qld_buyback_months',
    'qld_resale_value_days', 'nz_agm_months', 'pay_after_resale_days', 'urgent_days', 'high_days', 'normal_days', 'refurb_target_days', 'enquiry_quiet_days', 'warn_days'],
};
// Which columns a person uses to name a record, and which table a reference field points at.
const labels = { villages: ['code', 'name'], units: ['code'], contracts: ['number'], residents: ['name'], charges: ['number'], maintenance: ['number'], enquiries: ['name'],
  meetings: ['kind'], notes: ['title'], settings: ['business_name'] };
const refs = { village_id: 'villages', unit_id: 'units', contract_id: 'contracts' };

const need = (v, msg) => { if (v === undefined || v === null || v === '' || v === true) throw Error(msg); return v; };
const entity = (v) => { if (!Object.hasOwn(entities, v)) throw Error(`Unknown kind ${v}. Choose ${Object.keys(entities).join(', ')}`); return v; };
const today = () => new Date().toISOString().slice(0, 10);
const settingsOf = async (db) => (await db.query('select * from settings'))[0];
const dollars = (cents) => (cents === null || cents === undefined ? '' : Math.round(Number(cents) / 100).toLocaleString('en-NZ'));

export function parseArgs(args) {
  const pos = [], flags = {};
  for (const s of args) {
    if (s.startsWith('--')) { const i = s.indexOf('='); flags[s.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : s.slice(i + 1); }
    else pos.push(s);
  }
  return { pos, flags };
}

// Exact id or name first (case-insensitive), then id prefix or name fragment. One match or an error listing them.
export async function resolve(db, kind, value) {
  entity(kind);
  if (kind === 'settings') return (await db.query('select * from settings'))[0];
  need(value, `Specify a ${kind} name or id`);
  const keys = labels[kind];
  const exact = keys.map((k) => `lower(${k}::text)=lower($1)`).join(' or ');
  let rows = await db.query(`select * from ${kind} where id::text=$1 or ${exact}`, [String(value)]);
  if (!rows.length) rows = await db.query(`select * from ${kind} where starts_with(id::text,lower($1)) or ${keys.map((k) => `position(lower($1) in lower(${k}::text))>0`).join(' or ')} order by ${keys[0]}`, [String(value)]);
  if (rows.length !== 1) {
    const error = Error(rows.length ? `Ambiguous ${kind}: ${rows.slice(0, 12).map((r) => `${r.id} ${r[keys[0]]}`).join('; ')}${rows.length > 12 ? ` and ${rows.length - 12} more` : ''}` : `No ${kind} match: ${value}`);
    error.matches = rows.map((r) => ({ id: r.id, name: r[keys[0]] }));
    throw error;
  }
  return rows[0];
}

export function cents(v, where = 'Amount') {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const n = Number(String(v).replace(/[$,\s]|NZD|AUD/gi, ''));
  if (!Number.isFinite(n)) throw Error(`${where}: "${v}" is not an amount`);
  return Math.round(n * 100);
}

function num(v, where) {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const n = Number(String(v).replace(/[%,\s]/g, ''));
  if (!Number.isFinite(n)) throw Error(`${where}: "${v}" is not a number`);
  return n;
}

export function toDate(v, where = 'Date') {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = s.match(/^(\d{1,2})[/-](\d{1,2}|[A-Za-z]{3})[/-](\d{2,4})/);
    if (d) {
      const mon = /^\d/.test(d[2]) ? d[2].padStart(2, '0') : String(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(d[2].toLowerCase()) + 1).padStart(2, '0');
      m = [null, d[3].length === 2 ? `20${d[3]}` : d[3], mon, d[1].padStart(2, '0')];
    }
  }
  if (!m) throw Error(`${where}: "${s}" is not a date (use YYYY-MM-DD or DD/MM/YYYY)`);
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  if (Number.isNaN(Date.parse(iso + 'T00:00:00Z')) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso) throw Error(`${where}: "${s}" is not a real date`);
  return iso;
}

function month(v) {
  const m = String(need(v, 'Specify --month=YYYY-MM')).match(/^(\d{4})-(\d{2})$/);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw Error(`--month: "${v}" is not YYYY-MM`);
  return { start: `${m[1]}-${m[2]}-01`, end: new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10) };
}

export const insightQueries = [
  ['How long does each village take to relicense a unit, from keys back to the next resident settling?',
    `select v.code as village,count(*)::int as resales,round(avg(r.settled_on-p.vacated_on))::int as avg_days,min(r.settled_on-p.vacated_on) as fastest,max(r.settled_on-p.vacated_on) as slowest,
      round(avg(r.refurb_done_on-r.refurb_started_on))::int as avg_refurb_days,round(avg(r.settled_on-r.first_advertised_on))::int as avg_days_on_market
     from resales r join contracts p on p.id=r.prior_contract_id join units u on u.id=r.unit_id join villages v on v.id=u.village_id where r.settled_on is not null group by v.code order by avg_days desc`],
  ['What are empty units costing in weekly fees nobody is paying?',
    `select village,unit,kind,stage,days_empty,round(weekly_fee_cents/100.0) as weekly_fee,round(weekly_fee_cents*days_empty/700.0) as fees_forgone_so_far,
      round(weekly_fee_cents*52/100.0) as a_year_at_this_rate from v_vacancies where empty_since is not null order by fees_forgone_so_far desc`],
  ['How much exit money is owed, by village, and when is the first payment due?',
    `select village,currency,count(*)::int as departures_unpaid,round(sum(exit_cents)/100.0) as owed,min(coalesce(least(pay_by,nsw_order_from),pay_by,nsw_order_from)) as first_due,
      count(*) filter (where state='not yet listed')::int as not_yet_listed from v_exits where exit_paid_on is null group by village,currency order by owed desc`],
  ['What deferred management fee has each village earned on departures in the last 12 months?',
    `select village,currency,count(*)::int as departures,round(sum(dmf_cents)/100.0) as dmf_earned,round(avg(dmf_pct),1) as avg_dmf_pct,round(avg(years),1) as avg_years_in,
      round(sum(dmf_cents) filter (where exit_paid_on is null)/100.0) as not_yet_banked from v_exits where ended_on>=current_date-365 group by village,currency order by dmf_earned desc`],
  ["How did each resale price compare with the departing resident's ingoing?",
    `select v.code as village,u.code as unit,u.kind,p.number as departing,round(p.ingoing_cents/100.0) as their_ingoing,round(r.sold_cents/100.0) as resold_for,
      round(100.0*(r.sold_cents-p.ingoing_cents)/p.ingoing_cents,1) as pct_change,round((r.settled_on-p.settled_on)/365.25,1) as years_between
     from resales r join contracts p on p.id=r.prior_contract_id join units u on u.id=r.unit_id join villages v on v.id=u.village_id where r.sold_cents is not null order by pct_change desc`],
  ['Which residents are behind on fees, and by how much?',
    `select village,unit,residents,count(*)::int as charges,round(sum(billed_cents)/100.0,2) as owed,max(days_overdue) as oldest_days,currency from v_arrears group by village,unit,residents,currency order by owed desc`],
  ['Which maintenance categories cost the most in the last 12 months, by village?',
    `select village,category,count(*)::int as requests,round(sum(cost_cents)/100.0) as cost,count(*) filter (where resident_pays)::int as resident_paid,count(*) filter (where state<>'done')::int as still_open
     from v_maintenance where reported_on>=current_date-365 group by village,category order by cost desc,requests desc`],
  ['How fast is maintenance done against its target, by village and priority?',
    `select village,priority,count(*)::int as requests,count(*) filter (where done_on is not null)::int as done,round(avg(done_on-reported_on) filter (where done_on is not null),1) as avg_days_to_fix,
      count(*) filter (where (done_on is not null and done_on>target_on) or (done_on is null and current_date>target_on))::int as missed_target from v_maintenance group by village,priority order by village,priority`],
  ['Which enquiry sources turn into residents?',
    `select coalesce(source,'(not recorded)') as source,count(*)::int as enquiries,count(*) filter (where stage='moved in')::int as moved_in,count(*) filter (where stage='lost')::int as lost,
      count(*) filter (where stage not in ('moved in','lost'))::int as open,round(100.0*count(*) filter (where stage='moved in')/count(*))::int as pct_moved_in,
      round(avg(c.settled_on-q.first_contact_on) filter (where stage='moved in'))::int as days_to_move_in
     from enquiries q left join contracts c on c.id=q.contract_id group by source order by moved_in desc,enquiries desc`],
  ['How long do residents stay, by village and unit type?',
    `select village,unit_kind,count(*) filter (where state<>'current')::int as departed,round(avg(years) filter (where state<>'current'),1) as avg_years_departed,
      count(*) filter (where state='current')::int as current_residents,round(avg(years) filter (where state='current'),1) as avg_years_so_far from v_contracts group by village,unit_kind order by village,unit_kind`],
];

const reads = {
  villages: `select v.id,v.code,v.name,v.jurisdiction,v.council,v.metro,v.currency,v.year_end_month,v.manager,v.statutory_supervisor,
    (select count(*) from units u where u.village_id=v.id)::int as units from villages v order by v.code`,
  units: `select u.id,v.code as village,u.code as unit,u.kind,u.bedrooms,round(u.weekly_fee_cents/100.0,2) as weekly_fee,round(u.list_price_cents/100.0) as list_price,
    coalesce((select string_agg(r.name,' and ') from contracts c join residents r on r.contract_id=c.id where c.unit_id=u.id and c.vacated_on is null),'(empty)') as residents
    from units u join villages v on v.id=u.village_id order by u.code`,
  residents: `select r.id,c.village,c.unit,r.name,r.phone,r.email,r.next_of_kin,r.next_of_kin_phone,c.contract,c.state from residents r join v_contracts c on c.contract_id=r.contract_id
    where r.moved_out_on is null and c.vacated_on is null order by c.unit,r.name`,
  contracts: `select contract_id as id,village,unit,contract,residents,kind,settled_on,round(ingoing_cents/100.0) as ingoing,dmf_pct_per_year as dmf_per_year,dmf_cap_pct as dmf_cap,dmf_base,
    round(weekly_fee_cents/100.0,2) as weekly_fee,years,state from v_contracts order by case state when 'exit owed' then 1 when 'current' then 2 else 3 end,unit`,
  vacancies: `select village,unit,kind,stage,empty_since,days_empty,last_contract,refurb_started_on,refurb_done_on,first_advertised_on,round(asking_cents/100.0) as asking,
    round(weekly_fee_cents*days_empty/700.0) as fees_forgone from v_vacancies order by days_empty desc`,
  exits: `select contract_id as id,village,unit,contract,residents,ended_on,vacated_on,years,dmf_pct,round(exit_cents/100.0) as owed,currency,state,nsw_order_from,pay_by,exit_paid_on
    from v_exits order by exit_paid_on nulls first,coalesce(least(pay_by,nsw_order_from),pay_by,nsw_order_from)`,
  resales: `select r.id,v.code as village,u.code as unit,p.number as departing,p.vacated_on,r.agreed_value_on,round(r.agreed_value_cents/100.0) as agreed_value,r.refurb_started_on,r.refurb_done_on,
    round(r.refurb_cost_cents/100.0) as refurb_cost,r.first_advertised_on,round(r.asking_cents/100.0) as asking,round(r.sold_cents/100.0) as sold_for,r.settled_on
    from resales r join contracts p on p.id=r.prior_contract_id join units u on u.id=r.unit_id join villages v on v.id=u.village_id order by r.settled_on nulls first,p.vacated_on desc`,
  arrears: `select village,unit,residents,charge,period_start,round(billed_cents/100.0,2) as owed,due_on,days_overdue,currency from v_arrears order by days_overdue desc`,
  maintenance: `select request_id as id,village,unit,number,priority,category,description,reported_on,target_on,assigned_to,state,done_on,round(cost_cents/100.0) as cost
    from v_maintenance order by case state when 'overdue' then 1 when 'open' then 2 else 3 end,target_on`,
  enquiries: `select q.id,v.code as village,q.name,q.stage,q.wants,q.source,q.first_contact_on,q.last_contact_on,q.next_step,q.next_step_on from enquiries q left join villages v on v.id=q.village_id
    order by case when q.stage in ('moved in','lost') then 2 else 1 end,q.next_step_on nulls last`,
  meetings: `select m.id,v.code as village,m.kind,m.held_on,m.notice_given_on,m.note from meetings m join villages v on v.id=m.village_id order by m.held_on desc`,
  agm: `select village,jurisdiction,year_end,agm_by,agm_held_on,last_agm from v_agm order by village`,
  occupancy: `select v.code as village,v.name,count(u.id)::int as units,count(u.id) filter (where exists (select 1 from contracts c where c.unit_id=u.id and c.vacated_on is null))::int as occupied,
    round(100.0*count(u.id) filter (where exists (select 1 from contracts c where c.unit_id=u.id and c.vacated_on is null))/nullif(count(u.id),0))::int as pct_occupied,
    (select count(*) from v_exits e where e.village=v.code and e.exit_paid_on is null)::int as exits_owed,
    (select count(*) from v_maintenance m where m.village_id=v.id and m.state<>'done')::int as open_requests from villages v join units u on u.village_id=v.id group by v.id order by v.code`,
  compliance: `select rule,village,record,residents,finding,due_date,source from v_compliance order by rule,due_date`,
  settings: `select * from settings`,
};

async function filtered(db, sql, f) {
  let rows = await db.query(sql);
  if (f.village) { const v = await resolve(db, 'villages', f.village); rows = rows.filter((r) => !('village' in r) || r.village === v.code); }
  return rows;
}

// --field=value for writes. A *_cents field can be given in dollars without the suffix: --ingoing=520000 sets ingoing_cents.
async function fieldValues(db, kind, f) {
  const allowed = entities[kind], out = {};
  for (const [k, raw] of Object.entries(f)) {
    if (['json', 'dry-run'].includes(k)) continue;
    let key = k, v = raw === 'null' ? null : raw;
    if (!allowed.includes(key) && allowed.includes(`${k}_cents`)) { key = `${k}_cents`; v = cents(v, `--${k}`); }
    if (!allowed.includes(key)) throw Error(`${kind} has no field ${k}. Fields: ${allowed.join(', ')}`);
    if (refs[key] && v !== null && !/^[0-9a-f-]{36}$/i.test(String(v))) v = (await resolve(db, refs[key], v)).id;
    if (v === true) v = 'true';
    if (key.endsWith('_on') && v !== null) v = toDate(v, `--${k}`);
    out[key] = v;
  }
  return out;
}

const contractCols = `contract,village,unit,residents,kind,state,settled_on,round(ingoing_cents/100.0) as ingoing,ended_on,vacated_on,exit_paid_on`;

export async function execute(db, args) {
  const { pos, flags: f } = parseArgs(args);
  const [cmd = 'help', sub, ...rest] = pos;
  if (cmd === 'help' || f.help) return {
    commands: ['villages', 'units', 'residents', 'contracts', 'vacancies', 'exits', 'resales', 'charges [--month=YYYY-MM]', 'arrears', 'maintenance', 'enquiries', 'meetings', 'agm', 'occupancy',
      'compliance', 'attention', 'settings', 'village <code>', 'unit <code>', 'contract <number>', 'resident <name>', 'exit <contract>', 'insights [1..10]',
      'show <kind> <name|id>', 'add <kind> --field=value', 'update <kind> <name|id> --field=value',
      'move-in <unit> --contract=<number> --residents="Name; Name" --ingoing=dollars --on=date [--kind= --registered --dmf=%/yr --cap=% --base=ingoing|resale --share=% --refurb-share=% --fee=weekly]',
      'leave <contract> --ended=date [--vacated=date] [--stay-notice=date]', 'valuation <contract> --amount=dollars [--on=date] [--agreed]',
      'refurb <unit> [--start=date] [--done=date] [--cost=dollars]', 'advertise <unit> --price=dollars [--on=date]',
      'exit-paid <contract> [--on=date] [--amount=dollars] [--statement=date]', 'statement <contract> [--on=date]',
      'bill --month=YYYY-MM [--dry-run]', 'paid <charge> [--on=date]',
      'request <unit|village> <description> [--priority=urgent|high|normal] [--category=] [--by=]', 'done <request> [--cost=dollars] [--on=date] [--resident-pays]',
      'enquiry <name> --village= [--wants= --source= --phone= --email= --next= --next-on=date]', 'contact <enquiry> [--stage=] [--next=] [--next-on=date] [--lost=reason] [--on=date]',
      'meeting <village> --kind=AGM|special general|residents committee|budget --on=date [--notice=date]', 'log <unit> <note>',
      'import centrim --file=residents.csv [--village=code] [--dry-run]', 'import terms --file=contracts.csv [--dry-run]', 'export --out=backup.json',
      'weekly-review', 'draft-exit-statement <contract>', 'draft-family-update <contract>', 'draft-arrears <contract>', 'draft-enquiry <enquiry>', 'draft-agm-notice <village>'],
    note: 'Reads accept --village= and --json. Money flags are dollars; *_cents fields are cents. Drafts go to drafts/ and are never sent. Record checks are not legal advice: docs/compliance.md.',
  };

  if (reads[cmd]) return filtered(db, reads[cmd], f);

  if (cmd === 'charges') {
    const m = f.month ? month(f.month) : null;
    const rows = await db.query(`select ch.id,c.village,c.unit,c.residents,ch.number as charge,ch.kind,ch.period_start,ch.period_end,round(ch.full_cents/100.0,2) as full,round(ch.billed_cents/100.0,2) as billed,
      ch.due_on,ch.paid_on from charges ch join v_contracts c on c.contract_id=ch.contract_id ${m ? `where ch.period_start between '${m.start}' and '${m.end}'` : ''} order by ch.period_start desc,c.unit`);
    const v = f.village ? await resolve(db, 'villages', f.village) : null;
    const out = v ? rows.filter((r) => r.village === v.code) : rows;
    return m || f.all ? out : out.slice(0, 40);
  }

  if (cmd === 'attention') {
    const rows = await db.query(`select item,village,record,who,due_date,detail from v_attention order by case when item='EXIT DUE' or item like 'RULE%' then 1 when item='MAINTENANCE OVERDUE' then 2
      when item='FEES OVERDUE' then 3 when item in ('REFURB SLOW','UNIT NOT LISTED') then 4 else 5 end,due_date`);
    if (!f.village) return rows;
    const v = await resolve(db, 'villages', f.village);
    return rows.filter((r) => r.village === v.code);
  }

  if (cmd === 'village') {
    const v = await resolve(db, 'villages', sub);
    return {
      village: v,
      occupancy: (await execute(db, ['occupancy'])).find((r) => r.village === v.code),
      units: (await execute(db, ['units'])).filter((r) => r.village === v.code),
      exits_owed: (await execute(db, ['exits'])).filter((r) => r.village === v.code && !r.exit_paid_on),
      attention: (await execute(db, ['attention'])).filter((r) => r.village === v.code),
    };
  }

  if (cmd === 'unit') {
    const u = await resolve(db, 'units', sub);
    return {
      unit: (await execute(db, ['units'])).find((r) => r.unit === u.code),
      contracts: await db.query(`select ${contractCols} from v_contracts where unit_id=$1 order by settled_on desc`, [u.id]),
      resale: (await execute(db, ['resales'])).filter((r) => r.unit === u.code && !r.settled_on),
      maintenance: (await execute(db, ['maintenance'])).filter((r) => r.unit === u.code).slice(0, 10),
      notes: await db.query('select title,body,created_at from notes where unit_id=$1 order by created_at desc', [u.id]),
    };
  }

  if (cmd === 'contract') {
    const c = await resolve(db, 'contracts', sub);
    return {
      contract: (await db.query('select * from v_contracts where contract_id=$1', [c.id]))[0],
      residents: await db.query('select name,phone,email,born_on,next_of_kin,next_of_kin_phone,moved_out_on from residents where contract_id=$1 order by name', [c.id]),
      charges: (await db.query(`select number as charge,period_start,period_end,round(full_cents/100.0,2) as full,round(billed_cents/100.0,2) as billed,due_on,paid_on from charges where contract_id=$1 order by period_start desc limit 12`, [c.id])),
      exit: c.ended_on ? await execute(db, ['exit', c.number]) : null,
    };
  }

  if (cmd === 'resident') {
    const r = await resolve(db, 'residents', sub);
    return { resident: r, contract: r.contract_id ? (await db.query(`select ${contractCols} from v_contracts where contract_id=$1`, [r.contract_id]))[0] : null };
  }

  if (cmd === 'exit') {
    const c = await resolve(db, 'contracts', sub);
    const e = (await db.query('select * from v_exits where contract_id=$1', [c.id]))[0];
    if (!e) throw Error(`${c.number} has not ended. Record it first: leave ${c.number} --ended=YYYY-MM-DD`);
    const d = (x) => Math.round(Number(x || 0) / 100);
    return {
      contract: e.contract, unit: e.unit, village: e.village, residents: e.residents, jurisdiction: e.jurisdiction, currency: e.currency, state: e.state,
      settled_on: e.settled_on, ended_on: e.ended_on, vacated_on: e.vacated_on, years: e.years,
      working: [
        { line: 'Ingoing contribution', amount: d(e.ingoing_cents), how: `paid ${e.settled_on}` },
        { line: 'Less deferred management fee', amount: -d(e.dmf_cents), how: `${Number(c.dmf_pct_per_year)}% a year for ${e.years} years, capped at ${Number(c.dmf_cap_pct)}% = ${Number(e.dmf_pct)}% of the ${c.dmf_base === 'resale' ? `resale value (${d(e.resale_value_cents || e.ingoing_cents)})` : 'ingoing contribution'}` },
        { line: 'Plus share of capital gain', amount: d(e.gain_share_cents), how: e.resale_value_cents ? `${Number(c.resident_share_pct)}% of the gain over ${d(e.ingoing_cents)} on a resale value of ${d(e.resale_value_cents)}` : 'no resale value yet' },
        { line: 'Less share of refurbishment', amount: -d(e.refurb_share_cents), how: `${Number(c.refurb_share_pct)}% of the refurbishment cost` },
        { line: 'Less unpaid fees', amount: -d(e.unpaid_charges_cents), how: 'charges billed and not yet paid' },
        { line: 'Exit entitlement', amount: d(e.exit_cents), how: e.resale_value_cents ? 'on the figures recorded today' : 'estimate until a resale value is agreed' },
      ],
      dates: { nsw_order_from: e.nsw_order_from, pay_by: e.pay_by, agreed_value_on: e.agreed_value_on, first_advertised_on: e.first_advertised_on, resale_settled_on: e.resale_settled_on,
        exit_statement_on: e.exit_statement_on, exit_paid_on: e.exit_paid_on },
    };
  }

  if (cmd === 'insights') {
    const pickN = sub ? [Number(sub)] : insightQueries.map((_, i) => i + 1);
    const out = [];
    for (const n of pickN) {
      const q = insightQueries[n - 1];
      if (!q) throw Error(`Insights run 1 to ${insightQueries.length}`);
      out.push({ number: n, question: q[0], rows: await filtered(db, q[1], f) });
    }
    return out;
  }

  if (cmd === 'show') return resolve(db, entity(sub), rest[0]);

  if (cmd === 'add' || cmd === 'update') {
    const kind = entity(sub);
    const old = cmd === 'update' ? await resolve(db, kind, rest[0]) : null;
    const values = await fieldValues(db, kind, f);
    const keys = Object.keys(values);
    if (!keys.length) throw Error('Nothing to write. Pass --field=value');
    if (kind === 'settings' && cmd === 'add') throw Error('Settings has one row: update settings 1 --field=value');
    const sql = cmd === 'add'
      ? `insert into ${kind} (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`
      : `update ${kind} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} where id=$${keys.length + 1} returning *`;
    return (await db.query(sql, [...keys.map((k) => values[k]), ...(old ? [old.id] : [])]))[0];
  }

  if (cmd === 'move-in') {
    const u = await resolve(db, 'units', sub);
    const on = need(toDate(f.on, '--on'), 'Specify --on=YYYY-MM-DD (the settlement date)');
    const names = String(need(f.residents, 'Specify --residents="Name" or "Name; Name"')).split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    const current = (await db.query('select number from contracts where unit_id=$1 and ended_on is null', [u.id]))[0];
    if (current) throw Error(`${u.code} still has contract ${current.number}. Record the departure first: leave ${current.number} --ended=YYYY-MM-DD`);
    const v = (await db.query('select * from villages where id=$1', [u.village_id]))[0];
    const last = (await db.query('select * from contracts where unit_id=$1 order by settled_on desc limit 1', [u.id]))[0];
    const terms = {
      kind: f.kind || last?.kind || (v.jurisdiction === 'NZ' ? 'licence to occupy' : 'lease'),
      registered: f.registered === undefined ? Boolean(last?.registered_interest) : String(f.registered) !== 'false',
      dmf: num(f.dmf, '--dmf') ?? Number(last?.dmf_pct_per_year ?? 0), cap: num(f.cap, '--cap') ?? Number(last?.dmf_cap_pct ?? 0), base: f.base || last?.dmf_base || 'ingoing',
      share: num(f.share, '--share') ?? Number(last?.resident_share_pct ?? 0), refurb: num(f['refurb-share'], '--refurb-share') ?? Number(last?.refurb_share_pct ?? 0),
      fee: cents(f.fee, '--fee') ?? u.weekly_fee_cents,
    };
    const ingoing = need(cents(f.ingoing, '--ingoing'), 'Specify --ingoing=dollars (the ingoing contribution)');
    await db.exec('BEGIN');
    try {
      const c = (await db.query(`insert into contracts (unit_id,number,kind,registered_interest,signed_on,settled_on,ingoing_cents,dmf_pct_per_year,dmf_cap_pct,dmf_base,resident_share_pct,refurb_share_pct,weekly_fee_cents)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
        [u.id, need(f.contract, 'Specify --contract=<number>'), terms.kind, terms.registered, toDate(f.signed, '--signed'), on, ingoing, terms.dmf, terms.cap, terms.base, terms.share, terms.refurb, terms.fee]))[0];
      for (const name of names) await db.query('insert into residents (contract_id,name) values ($1,$2)', [c.id, name]);
      const resale = last ? (await db.query('update resales set new_contract_id=$1,sold_cents=$2,sold_on=coalesce(sold_on,$3::date),settled_on=$3 where prior_contract_id=$4 and settled_on is null returning *', [c.id, ingoing, on, last.id]))[0] : null;
      if (f.enquiry) { const q = await resolve(db, 'enquiries', f.enquiry); await db.query(`update enquiries set stage='moved in',contract_id=$1,last_contact_on=$2 where id=$3`, [c.id, on, q.id]); }
      await db.exec('COMMIT');
      const warnings = [];
      if (!terms.dmf) warnings.push('No deferred management fee terms: set them with --dmf and --cap, or update contracts later.');
      if (resale) warnings.push(`Resale of ${u.code} closed: the exit entitlement for ${last.number} is now payable by ${(await execute(db, ['exit', last.number])).dates.pay_by}.`);
      return { contract: c.number, unit: u.code, residents: names, terms, warnings };
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
  }

  if (cmd === 'leave') {
    const c = await resolve(db, 'contracts', sub);
    const ended = need(toDate(f.ended || f.on, '--ended'), 'Specify --ended=YYYY-MM-DD (the termination date)');
    if (ended < c.settled_on) throw Error(`${c.number} settled on ${c.settled_on}; it cannot end before that`);
    const vacated = toDate(f.vacated, '--vacated'), stay = toDate(f['stay-notice'], '--stay-notice');
    if (vacated && vacated < c.settled_on) throw Error('Vacated before settlement');
    const row = (await db.query(`update contracts set ended_on=$1,vacated_on=coalesce($2,vacated_on),stay_notice_on=coalesce($3,stay_notice_on) where id=$4 returning number,ended_on,vacated_on,stay_notice_on`, [ended, vacated, stay, c.id]))[0];
    if (vacated) await db.query('update residents set moved_out_on=$1 where contract_id=$2 and moved_out_on is null', [vacated, c.id]);
    await db.query('insert into resales (unit_id,prior_contract_id) values ($1,$2) on conflict (prior_contract_id) do nothing', [c.unit_id, c.id]);
    const e = await execute(db, ['exit', c.number]);
    return { ...row, exit_estimate: e.working.at(-1).amount, nsw_order_from: e.dates.nsw_order_from, pay_by: e.dates.pay_by,
      next: vacated ? 'Agree the resale value, book the refurbishment, and advertise.' : 'Record the keys coming back: leave ' + c.number + ` --ended=${ended} --vacated=YYYY-MM-DD` };
  }

  if (cmd === 'valuation') {
    const c = await resolve(db, 'contracts', sub);
    if (!c.ended_on) throw Error(`${c.number} has not ended`);
    const amount = need(cents(f.amount, '--amount'), 'Specify --amount=dollars');
    const on = toDate(f.on, '--on') || today();
    await db.query('insert into resales (unit_id,prior_contract_id) values ($1,$2) on conflict (prior_contract_id) do nothing', [c.unit_id, c.id]);
    const col = f.agreed ? ['agreed_value_cents', 'agreed_value_on'] : ['valuation_cents', 'valuation_on'];
    return (await db.query(`update resales set ${col[0]}=$1,${col[1]}=$2 where prior_contract_id=$3 returning agreed_value_cents,agreed_value_on,valuation_cents,valuation_on`, [amount, on, c.id]))[0];
  }

  if (cmd === 'refurb' || cmd === 'advertise') {
    const u = await resolve(db, 'units', sub);
    const r = (await db.query('select r.* from resales r join contracts c on c.id=r.prior_contract_id where r.unit_id=$1 and r.settled_on is null order by c.settled_on desc limit 1', [u.id]))[0];
    if (!r) throw Error(`${u.code} has no departure on record. Record it first: leave <contract> --ended=YYYY-MM-DD`);
    if (cmd === 'refurb') {
      if (!f.start && !f.done && f.cost === undefined) throw Error('Specify --start=date, --done=date or --cost=dollars');
      return (await db.query(`update resales set refurb_started_on=coalesce($1,refurb_started_on),refurb_done_on=coalesce($2,refurb_done_on),refurb_cost_cents=coalesce($3,refurb_cost_cents)
        where id=$4 returning refurb_started_on,refurb_done_on,refurb_cost_cents`, [toDate(f.start === true ? today() : f.start, '--start'), toDate(f.done === true ? today() : f.done, '--done'), cents(f.cost, '--cost'), r.id]))[0];
    }
    const price = need(cents(f.price, '--price'), 'Specify --price=dollars');
    await db.query('update units set list_price_cents=$1 where id=$2', [price, u.id]);
    return (await db.query('update resales set first_advertised_on=coalesce(first_advertised_on,$1),asking_cents=$2 where id=$3 returning first_advertised_on,asking_cents', [toDate(f.on, '--on') || today(), price, r.id]))[0];
  }

  if (cmd === 'exit-paid' || cmd === 'statement') {
    const c = await resolve(db, 'contracts', sub);
    if (!c.ended_on) throw Error(`${c.number} has not ended`);
    const on = toDate(f.on, '--on') || today();
    if (cmd === 'statement') return (await db.query('update contracts set exit_statement_on=$1 where id=$2 returning number,exit_statement_on', [on, c.id]))[0];
    if (c.exit_paid_on) throw Error(`${c.number} exit entitlement was paid on ${c.exit_paid_on}`);
    const e = await execute(db, ['exit', c.number]);
    const amount = cents(f.amount, '--amount') ?? e.working.at(-1).amount * 100;
    const row = (await db.query('update contracts set exit_paid_on=$1,exit_paid_cents=$2,exit_statement_on=coalesce($3,exit_statement_on) where id=$4 returning number,exit_paid_on,exit_paid_cents,exit_statement_on',
      [on, amount, toDate(f.statement === true ? on : f.statement, '--statement'), c.id]))[0];
    await db.query(`update charges set paid_on=$1,note=coalesce(note,'deducted from exit entitlement') where contract_id=$2 and paid_on is null`, [on, c.id]);
    return { ...row, warnings: row.exit_statement_on ? [] : ['No written exit statement recorded. Give one (npm run docs -- exit-statement) and record it: statement ' + c.number] };
  }

  if (cmd === 'bill') {
    const m = month(f.month);
    const rows = await db.query(`select c.id,c.number,c.weekly_fee_cents,greatest($1::date,c.settled_on) as start_on from contracts c
      where c.settled_on<=$2::date and c.exit_paid_on is null and (c.vacated_on is null or greatest($1::date,c.settled_on)<c.vacated_on or resident_fee_pct(c.id,greatest($1::date,c.settled_on))>0)
        and not exists (select 1 from charges ch where ch.contract_id=c.id and ch.kind='general services' and ch.period_start=greatest($1::date,c.settled_on)) order by c.number`, [m.start, m.end]);
    const made = [];
    await db.exec('BEGIN');
    try {
      for (const r of rows) {
        const days = (Date.parse(m.end) - Date.parse(r.start_on)) / 86400e3 + 1;
        const full = Math.round(r.weekly_fee_cents * days / 7);
        const pct = Number((await db.query('select resident_fee_pct($1,$2::date) as p', [r.id, r.start_on]))[0].p);
        const billed = Math.round(full * pct / 100);
        const due = new Date(Date.parse(r.start_on) + 14 * 86400e3).toISOString().slice(0, 10);
        await db.query(`insert into charges (contract_id,number,kind,period_start,period_end,full_cents,billed_cents,due_on) values ($1,$2,'general services',$3,$4,$5,$6,$7)`,
          [r.id, `${r.number}-${f.month}`, r.start_on, m.end, full, billed, due]);
        made.push({ contract: r.number, period_start: r.start_on, full: (full / 100).toFixed(2), billed: (billed / 100).toFixed(2), resident_share_pct: pct });
      }
      await db.exec(f['dry-run'] ? 'ROLLBACK' : 'COMMIT');
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
    return { month: f.month, charges: made.length, dry_run: Boolean(f['dry-run']), lines: made, sent: false };
  }

  if (cmd === 'paid') {
    const ch = await resolve(db, 'charges', sub);
    if (ch.paid_on) throw Error(`${ch.number} was paid on ${ch.paid_on}`);
    return (await db.query('update charges set paid_on=$1 where id=$2 returning number,paid_on,billed_cents', [toDate(f.on, '--on') || today(), ch.id]))[0];
  }

  if (cmd === 'request') {
    let unit = null, village;
    try { unit = await resolve(db, 'units', sub); village = { id: unit.village_id }; } catch { village = await resolve(db, 'villages', sub); }
    const priority = f.priority || 'normal';
    if (!['urgent', 'high', 'normal'].includes(priority)) throw Error('--priority must be urgent, high or normal');
    const n = (await db.query(`select count(*)::int as n from maintenance`))[0].n + 1001;
    const row = (await db.query(`insert into maintenance (number,village_id,unit_id,reported_by,reported_on,category,priority,description,assigned_to) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [f.number || `MR-${n}`, village.id, unit?.id || null, f.by || null, toDate(f.on, '--on') || today(), f.category || 'general', priority, need(rest.join(' '), 'Describe the job'), f.assign || null]))[0];
    return (await db.query('select number,village,unit,priority,category,description,target_on,state from v_maintenance where request_id=$1', [row.id]))[0];
  }

  if (cmd === 'done') {
    const m = await resolve(db, 'maintenance', sub);
    if (m.done_on) throw Error(`${m.number} was done on ${m.done_on}`);
    return (await db.query('update maintenance set done_on=$1,cost_cents=coalesce($2,cost_cents),resident_pays=$3 where id=$4 returning number,done_on,cost_cents,resident_pays',
      [toDate(f.on, '--on') || today(), cents(f.cost, '--cost'), Boolean(f['resident-pays']), m.id]))[0];
  }

  if (cmd === 'enquiry') {
    const v = f.village ? await resolve(db, 'villages', f.village) : null;
    return (await db.query(`insert into enquiries (name,email,phone,village_id,wants,source,first_contact_on,last_contact_on,next_step,next_step_on) values ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) returning *`,
      [need(sub, 'Specify the enquirer name'), f.email || null, f.phone || null, v?.id || null, f.wants || null, f.source || null, toDate(f.on, '--on') || today(), f.next || null, toDate(f['next-on'], '--next-on')]))[0];
  }

  if (cmd === 'contact') {
    const q = await resolve(db, 'enquiries', sub);
    const stage = f.lost ? 'lost' : f.stage || q.stage;
    if (!['enquiry', 'tour booked', 'toured', 'application', 'deposit', 'moved in', 'lost'].includes(stage)) throw Error('--stage must be enquiry, tour booked, toured, application, deposit, moved in or lost');
    return (await db.query(`update enquiries set stage=$1,last_contact_on=$2,next_step=$3,next_step_on=$4,lost_reason=coalesce($5,lost_reason) where id=$6 returning name,stage,last_contact_on,next_step,next_step_on`,
      [stage, toDate(f.on, '--on') || today(), f.next ?? (stage === 'lost' ? null : q.next_step), toDate(f['next-on'], '--next-on'), f.lost === true ? 'not recorded' : f.lost || null, q.id]))[0];
  }

  if (cmd === 'meeting') {
    const v = await resolve(db, 'villages', sub);
    const kind = f.kind || 'AGM';
    if (!['AGM', 'special general', 'residents committee', 'budget'].includes(kind)) throw Error('--kind must be AGM, special general, residents committee or budget');
    return (await db.query('insert into meetings (village_id,kind,held_on,notice_given_on,note) values ($1,$2,$3,$4,$5) returning kind,held_on,notice_given_on',
      [v.id, kind, need(toDate(f.on, '--on'), 'Specify --on=YYYY-MM-DD'), toDate(f.notice, '--notice'), f.note || null]))[0];
  }

  if (cmd === 'log') {
    const u = await resolve(db, 'units', sub);
    const c = (await db.query('select id from contracts where unit_id=$1 order by settled_on desc limit 1', [u.id]))[0];
    return (await db.query('insert into notes (village_id,unit_id,contract_id,title,body) values ($1,$2,$3,$4,$5) returning title,body,created_at', [u.village_id, u.id, c?.id || null, f.title || 'Note', need(rest.join(' '), 'Supply the note text')]))[0];
  }

  if (cmd === 'import') return importer(db, sub, f);

  if (cmd === 'export') {
    const snapshot = { format: 'retirement-village-for-claude-code/v1', exported_at: new Date().toISOString(), records: {} };
    await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      for (const kind of ['settings', 'villages', 'units', 'contracts', 'residents', 'charges', 'resales', 'maintenance', 'enquiries', 'meetings', 'notes']) snapshot.records[kind] = await db.query(`select * from ${kind} order by 1`);
      await db.exec('COMMIT');
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
    const out = path.resolve(need(f.out, 'Specify --out=backup.json'));
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { file: out, counts: Object.fromEntries(Object.entries(snapshot.records).map(([k, v]) => [k, v.length])) };
  }

  if (cmd === 'weekly-review') {
    const data = { attention: await execute(db, ['attention']), occupancy: await execute(db, ['occupancy']), compliance: await execute(db, ['compliance']) };
    const s = await settingsOf(db);
    const rules = data.compliance.filter((r) => r.due_date <= today()).length;
    const exits = data.attention.filter((r) => r.item === 'EXIT DUE');
    const lead = rules ? `${rules} record check(s) are past their date. Those come first.` : exits.length ? `${exits.length} exit entitlement(s) come due in the next few weeks.` : 'No rule dates passed and no exit money due soon.';
    return draft('weekly-review', `# ${s.business_name}: weekly village review, ${today()}\n\n${lead}\n\n## Occupancy\n\n${human(data.occupancy)}\n\n## Needs someone this week\n\n${human(data.attention)}\n\n` +
      `## Record checks\n\n${human(data.compliance.map(({ source, ...r }) => r))}\n\nSources for each rule: docs/compliance.md. Draft only, nothing has been sent.\n`, data);
  }

  if (cmd === 'draft-exit-statement') {
    const e = await execute(db, ['exit', sub]);
    const s = await settingsOf(db);
    const lines = e.working.map((w) => `| ${w.line} | ${w.amount.toLocaleString('en-NZ')} | ${w.how} |`).join('\n');
    const text = `# Draft only: exit entitlement statement\n\n${s.business_name}\nContract ${e.contract}, unit ${e.unit} (${e.village})\nFormer resident(s): ${e.residents}\n\n` +
      `Right to reside ended ${e.ended_on}. ${e.vacated_on ? `Vacant possession ${e.vacated_on}.` : 'Vacant possession not yet given.'} Time in the village: ${e.years} years.\n\n` +
      `| Item | ${e.currency} | How it was worked out |\n|---|---:|---|\n${lines}\n\n` +
      (e.jurisdiction === 'QLD' ? `Former residents' share of general services charges after 90 days is shown in the unpaid fees line. No interest is charged on these amounts.\n\n` : '') +
      `${e.dates.pay_by ? `Payable by ${e.dates.pay_by}.` : 'Payable when the unit is relicensed and the incoming resident settles, under the occupation right agreement.'}\n\n` +
      `Check every figure against the contract and the settlement statement before this is given. Nothing has been sent. Once given, record it: statement ${e.contract}\n`;
    return draft('exit-statement', text, e);
  }

  if (cmd === 'draft-family-update') {
    const e = await execute(db, ['exit', sub]);
    const c = await resolve(db, 'contracts', sub);
    const kin = (await db.query('select next_of_kin from residents where contract_id=$1 and next_of_kin is not null limit 1', [c.id]))[0];
    const r = (await db.query('select * from resales where prior_contract_id=$1', [c.id]))[0] || {};
    const s = await settingsOf(db);
    const steps = [r.refurb_started_on && `Refurbishment started ${r.refurb_started_on}${r.refurb_done_on ? ` and finished ${r.refurb_done_on}` : ', still under way'}.`,
      r.first_advertised_on && `Advertised from ${r.first_advertised_on}${r.asking_cents ? ` at ${dollars(r.asking_cents)}` : ''}.`,
      r.sold_on && `A new resident has signed; settlement ${r.settled_on || 'is being booked'}.`].filter(Boolean);
    const text = `# Draft only: update on unit ${e.unit}\n\nTo: ${kin?.next_of_kin || 'the family'}\nSubject: ${e.residents}, unit ${e.unit}: where things are\n\nHello,\n\n` +
      `${steps.length ? steps.join(' ') : 'We are preparing the unit for its next resident and will confirm the timeline shortly.'}\n\n` +
      `Based on the figures recorded today, the exit entitlement is about ${e.currency} ${e.working.at(-1).amount.toLocaleString('en-NZ')}. ` +
      `${e.dates.pay_by ? `It is payable by ${e.dates.pay_by}.` : 'It is paid once the next resident settles.'} A full written statement comes with the payment.\n\nKind regards,\n${s.business_name}\n\nNothing has been sent. Check the figures and dates before it goes.\n`;
    return draft('family-update', text, { exit: e, resale: r });
  }

  if (cmd === 'draft-arrears') {
    const c = await resolve(db, 'contracts', sub);
    const rows = await db.query('select charge,period_start,period_end,billed_cents,due_on,days_overdue,currency,residents from v_arrears where contract_id=$1 order by due_on', [c.id]);
    if (!rows.length) throw Error(`${c.number} has no overdue fees`);
    const s = await settingsOf(db);
    const total = rows.reduce((a, r) => a + Number(r.billed_cents), 0);
    const text = `# Draft only: weekly fees reminder\n\nTo: ${rows[0].residents}\nSubject: Your village fees\n\nDear ${rows[0].residents},\n\n` +
      `Our records show ${rows.length} fee period(s) unpaid, ${rows[0].currency} ${(total / 100).toFixed(2)} in total:\n\n${rows.map((r) => `- ${r.period_start} to ${r.period_end}: ${(r.billed_cents / 100).toFixed(2)}, due ${r.due_on}`).join('\n')}\n\n` +
      `If a payment has crossed with this note, thank you. If something has changed and you would like to talk about it, the village manager is happy to sit down with you.\n\nKind regards,\n${s.business_name}\n\nNothing has been sent. Check the payments received this week before it goes.\n`;
    return draft('fees-reminder', text, rows);
  }

  if (cmd === 'draft-enquiry') {
    const q = await resolve(db, 'enquiries', sub);
    const v = q.village_id ? (await db.query('select * from villages where id=$1', [q.village_id]))[0] : null;
    const free = v ? await db.query(`select unit,kind,bedrooms,stage,round(asking_cents/100.0) as asking from v_vacancies where village_id=$1 and stage in ('advertised','ready to list','refurbishing') order by stage`, [v.id]) : [];
    const s = await settingsOf(db);
    const text = `# Draft only: follow-up to ${q.name}\n\nTo: ${q.name}${q.email ? ` <${q.email}>` : ''}\nSubject: ${v ? v.name : 'Our villages'}\n\nHello,\n\nThank you for your interest${q.wants ? ` in a ${q.wants}` : ''}${v ? ` at ${v.name}` : ''}. ` +
      `${q.next_step ? `As promised: ${q.next_step.charAt(0).toLowerCase() + q.next_step.slice(1)}.` : ''}\n\n` +
      (free.length ? `Homes coming available now:\n\n${free.map((x) => `- ${x.unit}, ${x.bedrooms ?? ''} bedroom ${x.kind}${x.asking ? `, ${Number(x.asking).toLocaleString('en-NZ')}` : ''} (${x.stage})`).join('\n')}\n\n` : '') +
      `Would a time next week suit to walk through ${free.length ? 'one of these' : 'the village'}?\n\nKind regards,\n${s.business_name}\n\nNothing has been sent. Record the contact after it goes: contact "${q.name}" --next="..." --next-on=YYYY-MM-DD\n`;
    return draft('enquiry-follow-up', text, { enquiry: q, available: free });
  }

  if (cmd === 'draft-agm-notice') {
    const v = await resolve(db, 'villages', sub);
    const a = (await db.query('select * from v_agm where village_id=$1', [v.id]))[0];
    const s = await settingsOf(db);
    const text = `# Draft only: notice of annual general meeting\n\nTo: all residents of ${v.name}\nFrom: ${s.business_name}${v.statutory_supervisor ? `\nCopy: ${v.statutory_supervisor} (statutory supervisor)` : ''}\n\n` +
      `The annual general meeting of residents for the year ended ${a.year_end} will be held on (date) at (time) in (place).\n\nAgenda:\n\n1. The village financial statements for the year ended ${a.year_end}\n` +
      `${v.jurisdiction === 'NZ' ? '2. The statutory supervisor\'s report\n3. The maintenance report\n4. Other matters raised by residents\n' : '2. The maintenance report and the budget\n3. Other matters raised by residents\n'}\n` +
      `${v.jurisdiction === 'NZ' ? `This meeting must be held by ${a.agm_by} (Code of Practice 2008, clause 26).` : ''}\n\nNothing has been sent. Once held, record it: meeting ${v.code} --kind=AGM --on=YYYY-MM-DD\n`;
    return draft('agm-notice', text, a);
  }

  throw Error(`Unknown command ${cmd}. Run help.`);
}

function draft(prefix, text, data) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${prefix}-${today()}-${Math.random().toString(16).slice(2, 8)}.md`);
  fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 });
  return { file, data, sent: false };
}

const hidden = (k) => ['id', 'created_at', 'updated_at'].includes(k) || k.endsWith('_id');
export function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    if (typeof value[0] !== 'object' || value[0] === null) return value.map((v) => `  ${v}`).join('\n');
    if (value[0]?.question) return value.map((x) => `${x.number}. ${x.question}\n${human(x.rows)}`).join('\n\n');
    const keys = Object.keys(value[0]).filter((k) => !hidden(k));
    return table(value, keys.map((key) => ({ key, label: key.replaceAll('_', ' '), width: 70, format: (v) => (v instanceof Date ? v.toISOString().slice(0, 16) : v == null ? '' : String(v)) })));
  }
  if (value && typeof value === 'object') {
    const flat = (v) => v === null || typeof v !== 'object' || v instanceof Date;
    const scalars = Object.entries(value).filter(([k, v]) => flat(v) && !hidden(k)).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v instanceof Date ? v.toISOString().slice(0, 16) : v ?? ''}`);
    const nested = Object.entries(value).filter(([, v]) => !flat(v)).map(([k, v]) => `${k.replaceAll('_', ' ')}:\n${human(v)}`);
    return [scalars.join('\n'), ...nested].filter(Boolean).join('\n\n');
  }
  return String(value ?? '');
}

// Centrim Life resident and property lists, and contract terms from the finance system, saved from Excel as CSV.
// Neither publishes fixed column names, so the import reads the common labels below; docs/replace-centrim-life.md says how to add your own.
export const COLUMNS = {
  village: ['Village', 'Site', 'Community', 'Location', 'Facility'],
  unit: ['Unit', 'Unit No', 'Unit Number', 'Unit No.', 'Property', 'Apartment', 'Villa'],
  unit_type: ['Unit Type', 'Property Type', 'Type', 'Accommodation Type'],
  bedrooms: ['Bedrooms', 'Beds', 'No. Bedrooms'],
  name: ['Resident', 'Resident Name', 'Name', 'Full Name'],
  first: ['First Name', 'Given Name', 'Preferred Name', 'First'],
  last: ['Last Name', 'Surname', 'Family Name', 'Last'],
  email: ['Email', 'Email Address', 'E-mail'],
  phone: ['Phone', 'Mobile', 'Phone Number', 'Contact Number', 'Home Phone'],
  born: ['Date of Birth', 'DOB', 'Birth Date', 'Birthday'],
  moved_in: ['Move In Date', 'Move-in Date', 'Moved In', 'Entry Date', 'Occupancy Start', 'Start Date', 'Settlement Date'],
  nok: ['Next of Kin', 'Emergency Contact', 'NOK Name', 'Next of Kin Name', 'Emergency Contact Name'],
  nok_phone: ['Next of Kin Phone', 'Emergency Contact Phone', 'NOK Phone', 'Emergency Phone'],
  contract: ['Contract', 'Contract No', 'Contract Number', 'Agreement', 'ORA Number', 'Lease Number', 'Agreement No'],
  ingoing: ['Ingoing', 'Ingoing Contribution', 'Entry Payment', 'Capital Sum', 'Purchase Price', 'Licence Payment'],
  dmf: ['DMF % per year', 'DMF Rate', 'DMF per year', 'Exit Fee Rate', 'DMF %'],
  cap: ['DMF Cap', 'DMF Max', 'Maximum DMF', 'Exit Fee Cap', 'DMF Cap %'],
  base: ['DMF Base', 'DMF Calculated On', 'Exit Fee Base'],
  share: ['Capital Gain Share', 'Resident Share', 'Resident Share %', 'Capital Gain %'],
  fee: ['Weekly Fee', 'Weekly Fees', 'Service Fee', 'General Services Charge', 'Weekly Service Fee'],
};
const UNIT_KINDS = { villa: 'villa', apartment: 'apartment', 'serviced apartment': 'serviced apartment', serviced: 'serviced apartment', studio: 'studio', townhouse: 'townhouse', unit: 'villa', cottage: 'villa' };

async function importer(db, vendor, f) {
  if (!['centrim', 'terms'].includes(vendor)) throw Error('Supported imports: centrim (the resident list) and terms (contract terms from your finance system)');
  const file = need(f.file, 'Specify --file=report.csv');
  if (!String(file).toLowerCase().endsWith('.csv')) throw Error('Save the report from Excel as CSV first. Read docs/replace-centrim-life.md.');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw Error('CSV has no data rows');
  const get = (row, col) => pick(row, ...COLUMNS[col]).trim();
  const counts = { rows: rows.length, created: 0, updated: 0 };
  const warnings = [];
  await db.exec('BEGIN');
  try {
    if (vendor === 'centrim') {
      const fixed = f.village ? await resolve(db, 'villages', f.village) : null;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], where = `Row ${i + 2}`;
        const vName = fixed ? null : need(get(row, 'village'), `${where}: no Village column; pass --village=<code>`);
        const v = fixed || (await db.query('select * from villages where lower(code)=lower($1) or lower(name)=lower($1)', [vName]))[0];
        if (!v) throw Error(`${where}: village "${vName}" is not set up. Add it first: add villages --code=XX --name="${vName}" --jurisdiction=NZ|NSW|QLD|VIC|SA|WA`);
        const code = need(get(row, 'unit'), `${where}: Unit required`);
        const unitCode = code.toUpperCase().startsWith(v.code.toUpperCase()) ? code : `${v.code}-${code}`;
        let unit = (await db.query('select * from units where lower(code)=lower($1)', [unitCode]))[0];
        if (!unit) {
          const kind = UNIT_KINDS[get(row, 'unit_type').toLowerCase()] || 'villa';
          unit = (await db.query('insert into units (village_id,code,kind,bedrooms) values ($1,$2,$3,$4) returning *', [v.id, unitCode, kind, num(get(row, 'bedrooms'), `${where} Bedrooms`)]))[0];
          counts.units_added = (counts.units_added || 0) + 1;
        }
        const name = get(row, 'name') || [get(row, 'first'), get(row, 'last')].filter(Boolean).join(' ');
        need(name, `${where}: Resident name required`);
        let contract = (await db.query('select * from contracts where unit_id=$1 and ended_on is null', [unit.id]))[0];
        if (!contract) {
          const settled = need(toDate(get(row, 'moved_in'), `${where} Move In Date`), `${where}: Move In Date required for a new occupancy`);
          contract = (await db.query(`insert into contracts (unit_id,number,kind,settled_on,external_id) values ($1,$2,$3,$4,$5) returning *`,
            [unit.id, get(row, 'contract') || `${unitCode}-${settled.slice(0, 4)}`, v.jurisdiction === 'NZ' ? 'licence to occupy' : 'lease', settled, get(row, 'contract') || null]))[0];
          counts.contracts_added = (counts.contracts_added || 0) + 1;
        }
        const existing = (await db.query('select id from residents where contract_id=$1 and lower(name)=lower($2)', [contract.id, name]))[0];
        const vals = [get(row, 'email') || null, get(row, 'phone') || null, toDate(get(row, 'born'), `${where} Date of Birth`), get(row, 'nok') || null, get(row, 'nok_phone') || null];
        if (existing) await db.query('update residents set email=coalesce($1,email),phone=coalesce($2,phone),born_on=coalesce($3,born_on),next_of_kin=coalesce($4,next_of_kin),next_of_kin_phone=coalesce($5,next_of_kin_phone) where id=$6', [...vals, existing.id]);
        else await db.query('insert into residents (contract_id,name,email,phone,born_on,next_of_kin,next_of_kin_phone) values ($1,$2,$3,$4,$5,$6,$7)', [contract.id, name, ...vals]);
        counts[existing ? 'updated' : 'created']++;
      }
      const missing = (await db.query('select count(*)::int as n from contracts where ingoing_cents=0 and ended_on is null'))[0].n;
      if (missing) warnings.push(`${missing} current contract(s) have no ingoing or deferred management fee terms yet. Import them: import terms --file=contracts.csv`);
    } else {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], where = `Row ${i + 2}`;
        const key = get(row, 'contract') || get(row, 'unit');
        need(key, `${where}: Contract or Unit required`);
        const c = (await db.query(`select c.* from contracts c join units u on u.id=c.unit_id where lower(c.number)=lower($1) or lower(c.external_id)=lower($1) or (lower(u.code)=lower($1) and c.ended_on is null)`, [key]))[0];
        if (!c) throw Error(`${where}: no contract or current unit "${key}". Import the resident list first.`);
        const base = get(row, 'base').toLowerCase();
        await db.query(`update contracts set ingoing_cents=coalesce($1,ingoing_cents),dmf_pct_per_year=coalesce($2,dmf_pct_per_year),dmf_cap_pct=coalesce($3,dmf_cap_pct),
          dmf_base=coalesce($4,dmf_base),resident_share_pct=coalesce($5,resident_share_pct),weekly_fee_cents=coalesce($6,weekly_fee_cents) where id=$7`,
          [cents(get(row, 'ingoing'), `${where} Ingoing`), num(get(row, 'dmf'), `${where} DMF`), num(get(row, 'cap'), `${where} DMF Cap`), base ? (base.includes('resale') || base.includes('sale') ? 'resale' : 'ingoing') : null,
            num(get(row, 'share'), `${where} Share`), cents(get(row, 'fee'), `${where} Weekly Fee`), c.id]);
        counts.updated++;
      }
    }
    await db.exec(f['dry-run'] ? 'ROLLBACK' : 'COMMIT');
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
  return { import: vendor, ...counts, dry_run: Boolean(f['dry-run']), warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  const args = process.argv.slice(2), json = args.includes('--json');
  try { db = await getDb(); const out = await execute(db, args); console.log(json ? JSON.stringify(out, null, 2) : human(out)); }
  catch (e) { if (json) console.log(JSON.stringify({ error: e.message, ...(e.matches ? { matches: e.matches } : {}) })); else console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
