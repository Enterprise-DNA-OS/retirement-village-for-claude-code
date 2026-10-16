-- Retirement Village for Claude Code: the records of a retirement village operator.
-- Villages and their units, residents and their contracts (licence to occupy or lease, with the
-- deferred management fee terms), weekly fees, departures and what is owed back, resales and
-- refurbishment, maintenance requests, sales enquiries and residents' meetings.
-- Plain Postgres. Runs on any Postgres and on the embedded PGlite. No extensions.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Business-wide settings the checks read. One row. Each rule's source is in docs/compliance.md.
create table settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Your retirement village business',
  nsw_clock_start_days int not null default 40,          -- NSW: the order period starts 40 days after advertising, keys back or stay notice
  nsw_metro_months int not null default 6,                -- NSW: metropolitan local government areas
  nsw_other_months int not null default 12,               -- NSW: every other local government area
  nsw_charge_cap_days int not null default 42,            -- NSW Retirement Villages Act 1999 s 152 and s 154A
  qld_full_charge_days int not null default 90,           -- QLD Retirement Villages Act 1999 s 104: resident pays in full
  qld_shared_charge_months int not null default 9,        -- QLD s 104: shared until 9 months, then the operator pays
  qld_buyback_months int not null default 18,             -- QLD s 63: exit entitlement paid by 18 months after termination
  qld_resale_value_days int not null default 30,          -- QLD: agree the resale value within 30 days of termination
  nz_agm_months int not null default 6,                   -- NZ Code of Practice 2008 cl 26(1): AGM within 6 months of year end
  pay_after_resale_days int not null default 14,          -- exit paid this many days after the next resident settles
  urgent_days int not null default 1,                     -- maintenance targets by priority
  high_days int not null default 7,
  normal_days int not null default 28,
  refurb_target_days int not null default 42,             -- a refurbishment running longer than this needs a look
  enquiry_quiet_days int not null default 14,             -- an open enquiry with no contact for this long has gone quiet
  warn_days int not null default 45,                      -- how far ahead a deadline shows on attention
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

create table villages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  jurisdiction text not null check (jurisdiction in ('NZ', 'NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS', 'ACT', 'NT')),
  council text,                                           -- NSW: the local government area decides 6 or 12 months
  metro boolean not null default false,                   -- NSW: true when the council is on the metropolitan list
  currency text not null default 'AUD',
  year_end_month int not null default 6 check (year_end_month between 1 and 12),
  manager text,
  statutory_supervisor text,                              -- NZ
  registered_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages(id),
  code text not null unique,                              -- e.g. KG-07
  kind text not null default 'villa' check (kind in ('villa', 'apartment', 'serviced apartment', 'studio', 'townhouse')),
  bedrooms int,
  weekly_fee_cents int not null default 0,                -- the fee a new contract starts on
  list_price_cents bigint,                                -- current asking ingoing contribution
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One contract per occupancy of a unit. A couple shares one contract.
create table contracts (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  number text not null unique,
  kind text not null default 'licence to occupy' check (kind in ('licence to occupy', 'registered lease', 'lease', 'strata', 'rental')),
  registered_interest boolean not null default false,     -- NSW: a registered interest holder
  signed_on date,
  settled_on date not null,                               -- entry: the ingoing contribution paid and keys handed over
  ingoing_cents bigint not null default 0,
  dmf_pct_per_year numeric(5,2) not null default 0,       -- deferred management fee accrual
  dmf_cap_pct numeric(5,2) not null default 0,
  dmf_base text not null default 'ingoing' check (dmf_base in ('ingoing', 'resale')),
  resident_share_pct numeric(5,2) not null default 0,     -- resident's share of capital gain (NSW) or of the resale ingoing (QLD split)
  refurb_share_pct numeric(5,2) not null default 0,       -- resident's share of refurbishment on exit, from the contract
  weekly_fee_cents int not null default 0,
  ended_on date,                                          -- termination: the right to reside ends
  vacated_on date,                                        -- keys back and possessions out
  stay_notice_on date,                                    -- NSW: written notice the resident stays while it is for sale
  exit_statement_on date,                                 -- written exit entitlement statement given
  exit_paid_on date,
  exit_paid_cents bigint,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vacated_on is null or ended_on is not null)
);
create unique index contracts_one_current on contracts (unit_id) where ended_on is null;

create table residents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id),
  name text not null,
  email text,
  phone text,
  born_on date,
  next_of_kin text,
  next_of_kin_phone text,
  moved_out_on date,
  note text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Weekly fees, billed by period. full_cents is the whole charge; billed_cents is the resident's part.
create table charges (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id),
  number text not null unique,
  kind text not null default 'general services' check (kind in ('general services', 'maintenance reserve', 'other')),
  period_start date not null,
  period_end date not null,
  full_cents int not null,
  billed_cents int not null,
  due_on date not null,
  paid_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (contract_id, kind, period_start)
);

-- A unit coming back after a departure: valuation, refurbishment, advertising, the next resident.
create table resales (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  prior_contract_id uuid not null unique references contracts(id),
  agreed_value_cents bigint,
  agreed_value_on date,
  valuation_cents bigint,
  valuation_on date,
  refurb_started_on date,
  refurb_done_on date,
  refurb_cost_cents bigint not null default 0,
  first_advertised_on date,
  asking_cents bigint,
  new_contract_id uuid references contracts(id),
  sold_cents bigint,                                      -- the next resident's ingoing contribution
  sold_on date,
  settled_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table maintenance (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  village_id uuid not null references villages(id),
  unit_id uuid references units(id),
  reported_by text,
  reported_on date not null default current_date,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal')),
  description text not null,
  assigned_to text,
  done_on date,
  cost_cents int not null default 0,
  resident_pays boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  village_id uuid references villages(id),
  wants text,
  source text,
  stage text not null default 'enquiry' check (stage in ('enquiry', 'tour booked', 'toured', 'application', 'deposit', 'moved in', 'lost')),
  first_contact_on date not null default current_date,
  last_contact_on date,
  next_step text,
  next_step_on date,
  lost_reason text,
  contract_id uuid references contracts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages(id),
  kind text not null check (kind in ('AGM', 'special general', 'residents committee', 'budget')),
  held_on date not null,
  notice_given_on date,
  note text,
  created_at timestamptz not null default now(),
  unique (village_id, kind, held_on)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  village_id uuid references villages(id),
  unit_id uuid references units(id),
  contract_id uuid references contracts(id),
  title text not null default 'Note',
  body text not null,
  created_at timestamptz not null default now()
);

create trigger settings_touch before update on settings for each row execute function touch_updated_at();
create trigger villages_touch before update on villages for each row execute function touch_updated_at();
create trigger units_touch before update on units for each row execute function touch_updated_at();
create trigger contracts_touch before update on contracts for each row execute function touch_updated_at();
create trigger residents_touch before update on residents for each row execute function touch_updated_at();
create trigger charges_touch before update on charges for each row execute function touch_updated_at();
create trigger resales_touch before update on resales for each row execute function touch_updated_at();
create trigger maintenance_touch before update on maintenance for each row execute function touch_updated_at();
create trigger enquiries_touch before update on enquiries for each row execute function touch_updated_at();

-- The share of a fee period a former resident may be billed, as a percentage, for a period starting on_date.
-- NSW: 42 days in full, then the capital gain share (registered interest) or nothing.
-- QLD: 90 days in full, then the resale share until 9 months, then nothing.
-- Everywhere else: the contract decides; this returns 100 until the next resident settles.
create or replace function resident_fee_pct(p_contract uuid, on_date date) returns numeric language sql stable as $$
  select case
    when c.vacated_on is null or on_date < c.vacated_on then 100
    when r.settled_on is not null and on_date >= r.settled_on then 0
    when v.jurisdiction = 'NSW' then
      case when on_date < c.vacated_on + s.nsw_charge_cap_days then 100
           when c.registered_interest then c.resident_share_pct else 0 end
    when v.jurisdiction = 'QLD' then
      case when on_date < c.vacated_on + s.qld_full_charge_days then 100
           when on_date < (c.vacated_on + make_interval(months => s.qld_shared_charge_months))::date then c.resident_share_pct
           else 0 end
    else 100 end
  from contracts c join units u on u.id = c.unit_id join villages v on v.id = u.village_id
  cross join settings s left join resales r on r.prior_contract_id = c.id
  where c.id = p_contract
$$;

create view v_contracts as
select c.id as contract_id, c.number as contract, v.code as village, v.name as village_name, v.jurisdiction, v.currency, u.code as unit, u.kind as unit_kind,
  (select string_agg(r.name, ' and ' order by r.name) from residents r where r.contract_id = c.id) as residents,
  c.kind, c.registered_interest, c.settled_on, c.ingoing_cents, c.weekly_fee_cents, c.dmf_pct_per_year, c.dmf_cap_pct, c.dmf_base, c.resident_share_pct,
  c.ended_on, c.vacated_on, c.exit_paid_on,
  case when c.ended_on is null then 'current' when c.exit_paid_on is null then 'exit owed' else 'closed' end as state,
  round((coalesce(c.ended_on, current_date) - c.settled_on) / 365.25, 1) as years,
  c.unit_id, u.village_id
from contracts c join units u on u.id = c.unit_id join villages v on v.id = u.village_id;

-- What is owed back to each departed resident, and by when. Amounts in cents.
create view v_exits as
with base as (
  select c.*, v.jurisdiction, v.metro, v.currency, v.code as village, u.code as unit, r.id as resale_id, r.agreed_value_cents, r.agreed_value_on,
    r.valuation_cents, r.valuation_on, r.refurb_cost_cents, r.first_advertised_on, r.sold_cents, r.sold_on, r.settled_on as resale_settled_on,
    least(((c.ended_on - c.settled_on) / 365.25) * c.dmf_pct_per_year, c.dmf_cap_pct) as dmf_pct,
    coalesce(r.sold_cents, r.agreed_value_cents, r.valuation_cents) as resale_value_cents,
    s.nsw_clock_start_days, s.nsw_metro_months, s.nsw_other_months, s.qld_buyback_months, s.pay_after_resale_days
  from contracts c join units u on u.id = c.unit_id join villages v on v.id = u.village_id cross join settings s
  left join resales r on r.prior_contract_id = c.id
  where c.ended_on is not null
), money as (
  select b.*,
    round(case when b.dmf_base = 'resale' then coalesce(b.resale_value_cents, b.ingoing_cents) else b.ingoing_cents end * b.dmf_pct / 100) as dmf_cents,
    round(greatest(coalesce(b.resale_value_cents, b.ingoing_cents) - b.ingoing_cents, 0) * b.resident_share_pct / 100) as gain_share_cents,
    round(coalesce(b.refurb_cost_cents, 0) * b.refurb_share_pct / 100) as refurb_share_cents,
    coalesce((select sum(ch.billed_cents) from charges ch where ch.contract_id = b.id and ch.paid_on is null), 0) as unpaid_charges_cents,
    case when b.jurisdiction = 'NSW' and b.registered_interest then
      (least(b.first_advertised_on, b.vacated_on, b.stay_notice_on) + b.nsw_clock_start_days) end as nsw_clock_starts
  from base b
)
select m.id as contract_id, m.number as contract, m.village, m.unit, m.jurisdiction, m.currency,
  (select string_agg(r.name, ' and ' order by r.name) from residents r where r.contract_id = m.id) as residents,
  m.settled_on, m.ended_on, m.vacated_on, round((m.ended_on - m.settled_on) / 365.25, 2) as years,
  round(m.dmf_pct, 2) as dmf_pct, m.ingoing_cents, m.resale_value_cents, m.dmf_cents, m.gain_share_cents, m.refurb_share_cents, m.unpaid_charges_cents,
  (m.ingoing_cents - m.dmf_cents + m.gain_share_cents - m.refurb_share_cents - m.unpaid_charges_cents) as exit_cents,
  m.nsw_clock_starts,
  case when m.nsw_clock_starts is not null then (m.nsw_clock_starts + make_interval(months => case when m.metro then m.nsw_metro_months else m.nsw_other_months end))::date end as nsw_order_from,
  case
    when m.jurisdiction = 'QLD' then least((m.ended_on + make_interval(months => m.qld_buyback_months))::date, m.resale_settled_on + m.pay_after_resale_days)
    when m.resale_settled_on is not null then m.resale_settled_on + m.pay_after_resale_days
  end as pay_by,
  m.agreed_value_on, m.valuation_on, m.first_advertised_on, m.sold_on, m.resale_settled_on, m.exit_statement_on, m.exit_paid_on, m.exit_paid_cents,
  case when m.exit_paid_on is not null then 'paid' when m.resale_settled_on is not null then 'resold, pay now' when m.sold_on is not null then 'sold, awaiting settlement'
       when m.first_advertised_on is not null then 'on the market' else 'not yet listed' end as state
from money m;

create view v_vacancies as
select u.id as unit_id, v.code as village, u.code as unit, u.kind, u.bedrooms, u.weekly_fee_cents, u.list_price_cents, last.number as last_contract, last.vacated_on as empty_since,
  current_date - coalesce(last.vacated_on, u.created_at::date) as days_empty,
  r.refurb_started_on, r.refurb_done_on, r.first_advertised_on, r.asking_cents, r.sold_on,
  case when r.sold_on is not null then 'sold' when r.first_advertised_on is not null then 'advertised' when r.refurb_done_on is not null then 'ready to list'
       when r.refurb_started_on is not null then 'refurbishing' when last.id is not null then 'awaiting refurbishment' else 'never occupied' end as stage,
  u.village_id
from units u join villages v on v.id = u.village_id
left join lateral (select * from contracts c where c.unit_id = u.id order by c.settled_on desc limit 1) last on true
left join resales r on r.prior_contract_id = last.id
where not exists (select 1 from contracts c where c.unit_id = u.id and c.vacated_on is null);

create view v_arrears as
select ch.id as charge_id, ch.number as charge, c.number as contract, v.code as village, u.code as unit,
  (select string_agg(r.name, ' and ' order by r.name) from residents r where r.contract_id = c.id) as residents,
  ch.kind, ch.period_start, ch.period_end, ch.billed_cents, ch.due_on, current_date - ch.due_on as days_overdue, c.id as contract_id, v.currency
from charges ch join contracts c on c.id = ch.contract_id join units u on u.id = c.unit_id join villages v on v.id = u.village_id
where ch.paid_on is null and ch.due_on < current_date and ch.billed_cents > 0 and c.vacated_on is null; -- a former resident's unpaid fees come off the exit entitlement

create view v_maintenance as
select m.id as request_id, m.number, v.code as village, u.code as unit, m.category, m.priority, m.description, m.reported_by, m.reported_on, m.assigned_to,
  m.reported_on + case m.priority when 'urgent' then s.urgent_days when 'high' then s.high_days else s.normal_days end as target_on,
  m.done_on, m.cost_cents, m.resident_pays,
  case when m.done_on is not null then 'done'
       when current_date > m.reported_on + case m.priority when 'urgent' then s.urgent_days when 'high' then s.high_days else s.normal_days end then 'overdue' else 'open' end as state,
  m.village_id, m.unit_id
from maintenance m join villages v on v.id = m.village_id left join units u on u.id = m.unit_id cross join settings s;

-- The last completed financial year end, and when its AGM is due, for every village.
create view v_agm as
with y as (
  select v.*, s.nz_agm_months, s.warn_days,
    (make_date(extract(year from current_date)::int - case when extract(month from current_date) > v.year_end_month then 0 else 1 end, v.year_end_month, 1) + interval '1 month' - interval '1 day')::date as year_end
  from villages v cross join settings s
)
select y.id as village_id, y.code as village, y.jurisdiction, y.year_end, (y.year_end + make_interval(months => y.nz_agm_months))::date as agm_by,
  (select max(m.held_on) from meetings m where m.village_id = y.id and m.kind = 'AGM' and m.held_on > y.year_end) as agm_held_on,
  (select max(m.held_on) from meetings m where m.village_id = y.id and m.kind = 'AGM') as last_agm
from y;

create view v_compliance as
-- NSW: registered interest holders can apply for an exit entitlement order once the 6 or 12 months has run.
select 'NSW-EXIT-ORDER' as rule, e.village, e.contract as record, e.residents,
  case when e.nsw_order_from <= current_date then 'Exit entitlement unpaid; the former resident can apply for an order from ' || e.nsw_order_from
       else 'Order period ends ' || e.nsw_order_from || '; exit entitlement still unpaid' end as finding,
  e.nsw_order_from as due_date, 'NSW Retirement Villages Act 1999, exit entitlement orders (nsw.gov.au)' as source
from v_exits e cross join settings s
where e.jurisdiction = 'NSW' and e.exit_paid_on is null and e.nsw_order_from is not null and e.nsw_order_from <= current_date + s.warn_days
union all
-- NSW: an order needs an agreed valuation made at least 30 days before the application.
select 'NSW-AGREED-VALUATION', e.village, e.contract, e.residents,
  'No agreed valuation recorded; one must be made at least 30 days before an order application', e.nsw_order_from - 30,
  'NSW Retirement Villages Act 1999, exit entitlement orders (nsw.gov.au)'
from v_exits e cross join settings s
where e.jurisdiction = 'NSW' and e.exit_paid_on is null and e.nsw_order_from is not null and e.agreed_value_on is null and e.nsw_order_from - 30 <= current_date + s.warn_days
union all
-- NSW and QLD: fees billed to a former resident beyond what the Act lets them be charged.
select case v.jurisdiction when 'NSW' then 'NSW-CHARGE-CAP' else 'QLD-SHARED-CHARGES' end, v.code, ch.number,
  (select string_agg(r.name, ' and ' order by r.name) from residents r where r.contract_id = c.id),
  'Billed ' || to_char(ch.billed_cents / 100.0, 'FM999G999D00') || ' for ' || ch.period_start || ' to ' || ch.period_end || '; the most the former resident can be charged is '
    || to_char(round(ch.full_cents * resident_fee_pct(c.id, ch.period_start) / 100) / 100.0, 'FM999G999D00') || ' (' || round(resident_fee_pct(c.id, ch.period_start)) || '% of the period)',
  ch.due_on,
  case v.jurisdiction when 'NSW' then 'NSW Retirement Villages Act 1999 s 152 (recurrent charges after leaving, nsw.gov.au)' else 'QLD Retirement Villages Act 1999 s 104 (business.qld.gov.au)' end
from charges ch join contracts c on c.id = ch.contract_id join units u on u.id = c.unit_id join villages v on v.id = u.village_id
where v.jurisdiction in ('NSW', 'QLD') and c.vacated_on is not null and ch.period_start >= c.vacated_on
  and ch.billed_cents > round(ch.full_cents * resident_fee_pct(c.id, ch.period_start) / 100) + 100
union all
-- QLD: exit entitlement paid by 18 months after termination if the unit has not sold.
select 'QLD-BUYBACK', e.village, e.contract, e.residents,
  case when e.pay_by < current_date then 'Exit entitlement was due ' || e.pay_by || ' and is unpaid' else 'Exit entitlement due by ' || e.pay_by end,
  e.pay_by, 'QLD Retirement Villages Act 1999 s 63 (business.qld.gov.au)'
from v_exits e cross join settings s
where e.jurisdiction = 'QLD' and e.exit_paid_on is null and e.pay_by <= current_date + s.warn_days
union all
-- QLD: agree the resale value within 30 days of termination, or get a valuation.
select 'QLD-RESALE-VALUE', e.village, e.contract, e.residents,
  'No agreed resale value or valuation recorded; agree it within ' || s.qld_resale_value_days || ' days of termination (' || (e.ended_on + s.qld_resale_value_days) || ')',
  e.ended_on + s.qld_resale_value_days, 'QLD Retirement Villages Act 1999, residents leaving (business.qld.gov.au)'
from v_exits e cross join settings s
where e.jurisdiction = 'QLD' and e.exit_paid_on is null and e.agreed_value_on is null and e.valuation_on is null and e.ended_on + s.qld_resale_value_days <= current_date + 14
union all
-- QLD: a written statement showing how the exit entitlement was worked out, given when it is paid.
select 'QLD-EXIT-STATEMENT', e.village, e.contract, e.residents,
  'Exit entitlement paid ' || e.exit_paid_on || ' with no written exit statement recorded', e.exit_paid_on,
  'QLD Retirement Villages Act 1999, exit entitlement statement (business.qld.gov.au)'
from v_exits e
where e.jurisdiction = 'QLD' and e.exit_paid_on is not null and e.exit_statement_on is null
union all
-- NZ: an annual general meeting within 6 months of the end of the financial year.
select 'NZ-AGM', a.village, 'AGM for year ended ' || a.year_end, null,
  case when a.agm_held_on > a.agm_by then 'AGM held ' || a.agm_held_on || ', after the ' || a.agm_by || ' deadline'
       when a.agm_by < current_date then 'No AGM recorded since ' || a.year_end || '; it was due by ' || a.agm_by
       else 'AGM due by ' || a.agm_by || '; none recorded yet' end,
  a.agm_by, 'NZ Retirement Villages Code of Practice 2008 cl 26(1); Retirement Villages (General) Regulations 2006 reg 10'
from v_agm a cross join settings s
where a.jurisdiction = 'NZ' and ((a.agm_held_on is null and a.agm_by <= current_date + s.warn_days) or a.agm_held_on > a.agm_by);

create view v_attention as
select 'EXIT DUE' as item, e.village, e.contract as record, e.residents as who, coalesce(least(e.pay_by, e.nsw_order_from), e.pay_by, e.nsw_order_from) as due_date,
  'Owed ' || e.currency || ' ' || to_char(e.exit_cents / 100.0, 'FM999G999G999') || ' (' || e.state || ')' as detail
from v_exits e cross join settings s
where e.exit_paid_on is null and coalesce(least(e.pay_by, e.nsw_order_from), e.pay_by, e.nsw_order_from) <= current_date + s.warn_days
union all
select 'RULE ' || c.rule, c.village, c.record, c.residents, c.due_date, c.finding from v_compliance c where c.rule not in ('NSW-EXIT-ORDER', 'QLD-BUYBACK')
union all
select 'MAINTENANCE OVERDUE', m.village, m.number, coalesce(m.unit, 'common area'), m.target_on, m.priority || ': ' || m.description
from v_maintenance m where m.state = 'overdue'
union all
select 'FEES OVERDUE', a.village, a.contract, a.residents, min(a.due_on),
  count(*) || ' charge(s), ' || a.currency || ' ' || to_char(sum(a.billed_cents) / 100.0, 'FM999G999D00') || ' unpaid'
from v_arrears a group by a.village, a.contract, a.residents, a.currency
union all
select case when vv.stage in ('awaiting refurbishment', 'refurbishing') then 'REFURB SLOW' else 'UNIT NOT LISTED' end, vv.village, vv.unit, vv.last_contract, vv.empty_since,
  vv.stage || ' for ' || vv.days_empty || ' days, ' || coalesce(to_char(vv.weekly_fee_cents * vv.days_empty / 700.0, 'FM999G999'), '0') || ' in fees not coming in'
from v_vacancies vv cross join settings s
where vv.empty_since is not null and vv.stage in ('awaiting refurbishment', 'refurbishing', 'ready to list') and vv.days_empty > case when vv.stage = 'ready to list' then 7 else s.refurb_target_days end
union all
select 'ENQUIRY QUIET', v.code, q.name, q.stage, coalesce(q.next_step_on, q.last_contact_on + s.enquiry_quiet_days),
  coalesce('Next step was: ' || q.next_step, 'No contact since ' || coalesce(q.last_contact_on, q.first_contact_on))
from enquiries q left join villages v on v.id = q.village_id cross join settings s
where q.stage not in ('moved in', 'lost') and (q.next_step_on < current_date or coalesce(q.last_contact_on, q.first_contact_on) < current_date - s.enquiry_quiet_days);
