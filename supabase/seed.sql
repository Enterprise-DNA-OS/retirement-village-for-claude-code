-- Demo data: one fictional operator with three villages, one each in New Zealand, New South Wales
-- and Queensland. Dates are relative to today, so there is always an exit entitlement coming due,
-- a former resident billed past the cap, an AGM late, a refurbishment dragging and fees behind.
-- Idempotent: fixed ids and numbers, on conflict do nothing. Every name and record here is invented.

update settings set business_name = 'Harbourview Living (demo)' where id = 1;

-- The NZ village's year ended about seven months ago, so its AGM is due about now.
insert into villages (id, code, name, jurisdiction, council, metro, currency, year_end_month, manager, statutory_supervisor, registered_on) values
  ('10000000-0000-4000-8000-000000000001', 'KG', 'Kowhai Grove', 'NZ', 'Tauranga City Council', false, 'NZD',
    extract(month from current_date - interval '7 months')::int, 'Aroha Bennett', 'Southern Trustee Supervisors (demo)', '2011-05-02'),
  ('10000000-0000-4000-8000-000000000002', 'BR', 'Banksia Ridge', 'NSW', 'Hornsby', true, 'AUD', 6, 'Greg Lawson', null, '2008-09-15'),
  ('10000000-0000-4000-8000-000000000003', 'PP', 'Pandanus Point', 'QLD', 'Sunshine Coast', false, 'AUD', 6, 'Mel Tran', null, '2012-03-20')
on conflict (id) do nothing;

insert into units (id, village_id, code, kind, bedrooms, weekly_fee_cents, list_price_cents)
select ('20000000-0000-4000-8000-' || lpad(x.n::text, 12, '0'))::uuid, v.id, x.code, x.kind, x.beds, x.fee, x.price
from (values
  (1, 'KG', 'KG-01', 'villa', 2, 16500, 58500000), (2, 'KG', 'KG-02', 'villa', 2, 16500, 59500000), (3, 'KG', 'KG-03', 'villa', 3, 18200, 71500000),
  (4, 'KG', 'KG-04', 'apartment', 2, 17400, 64000000), (5, 'KG', 'KG-05', 'apartment', 1, 15200, 49500000), (6, 'KG', 'KG-06', 'serviced apartment', 1, 32000, 42000000),
  (7, 'KG', 'KG-07', 'villa', 2, 16500, 61000000), (8, 'KG', 'KG-08', 'villa', 3, 18200, 76000000),
  (9, 'BR', 'BR-01', 'villa', 2, 19800, 82000000), (10, 'BR', 'BR-02', 'villa', 3, 22100, 94500000), (11, 'BR', 'BR-03', 'villa', 2, 19800, 83500000),
  (12, 'BR', 'BR-04', 'apartment', 2, 18900, 76000000), (13, 'BR', 'BR-05', 'apartment', 1, 16400, 64000000), (14, 'BR', 'BR-06', 'apartment', 2, 18900, 77000000),
  (15, 'BR', 'BR-07', 'townhouse', 3, 23500, 99000000), (16, 'BR', 'BR-08', 'villa', 2, 19800, 84000000),
  (17, 'PP', 'PP-01', 'villa', 2, 16200, 54500000), (18, 'PP', 'PP-02', 'villa', 2, 16200, 54000000), (19, 'PP', 'PP-03', 'villa', 3, 18400, 64000000),
  (20, 'PP', 'PP-04', 'apartment', 2, 15800, 49500000), (21, 'PP', 'PP-05', 'apartment', 1, 14300, 41500000), (22, 'PP', 'PP-06', 'villa', 2, 16200, 56000000),
  (23, 'PP', 'PP-07', 'villa', 3, 18400, 65500000), (24, 'PP', 'PP-08', 'studio', 1, 13100, 36000000)
) as x(n, village, code, kind, beds, fee, price)
join villages v on v.code = x.village
on conflict (id) do nothing;

-- Contracts. Offsets are days from today; null is not yet. Amounts in cents.
insert into contracts (id, unit_id, number, kind, registered_interest, signed_on, settled_on, ingoing_cents, dmf_pct_per_year, dmf_cap_pct, dmf_base,
  resident_share_pct, refurb_share_pct, weekly_fee_cents, ended_on, vacated_on, stay_notice_on, exit_statement_on, exit_paid_on)
select ('30000000-0000-4000-8000-' || lpad(x.n::text, 12, '0'))::uuid, u.id, x.number, x.kind, x.reg, current_date + x.settled - 21, current_date + x.settled, x.ingoing,
  x.dmf, x.cap, x.base, x.share, x.refurb, x.fee, current_date + x.ended, current_date + x.vacated, null, current_date + x.statement, current_date + x.paid
from (values
  -- Kowhai Grove, NZ: licence to occupy, 10% a year to 30% of the ingoing, no capital gain
  (1, 'KG-01', 'KG-0101', 'licence to occupy', false, -2900, 45600000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 14200, null::int, null::int, null::int, null::int),
  (2, 'KG-02', 'KG-0201', 'licence to occupy', false, -4100, 38900000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 12100, -1580, -1575, -1495, -1495),
  (3, 'KG-02', 'KG-0202', 'licence to occupy', false, -1500, 52900000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 15400, null, null, null, null),
  (4, 'KG-03', 'KG-0301', 'licence to occupy', false, -800, 68900000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 17900, null, null, null, null),
  (5, 'KG-04', 'KG-0401', 'licence to occupy', false, -3600, 45200000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 13600, null, null, null, null),
  (6, 'KG-05', 'KG-0501', 'licence to occupy', false, -400, 48900000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 15200, null, null, null, null),
  (7, 'KG-06', 'KG-0601', 'licence to occupy', false, -2200, 36800000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 29500, null, null, null, null),
  (8, 'KG-07', 'KG-0701', 'licence to occupy', false, -3300, 43100000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 13900, -75, -70, null, null),
  (9, 'KG-08', 'KG-0801', 'licence to occupy', false, -2600, 57900000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 15600, -210, -205, -110, -110),
  (10, 'KG-08', 'KG-0802', 'licence to occupy', false, -120, 74500000, 10.0, 30.0, 'ingoing', 0.0, 0.0, 18200, null, null, null, null),
  -- Banksia Ridge, NSW: registered leases share half the capital gain; 5% a year to 25%
  (11, 'BR-01', 'BR-0101', 'registered lease', true, -3800, 56000000, 5.0, 25.0, 'ingoing', 50.0, 50.0, 15900, -950, -945, -895, -895),
  (12, 'BR-01', 'BR-0102', 'registered lease', true, -900, 79000000, 5.0, 25.0, 'ingoing', 50.0, 50.0, 19400, null, null, null, null),
  (13, 'BR-02', 'BR-0201', 'registered lease', true, -2500, 81800000, 5.0, 25.0, 'ingoing', 50.0, 50.0, 20800, null, null, null, null),
  (14, 'BR-03', 'BR-0301', 'registered lease', true, -3500, 61200000, 5.0, 25.0, 'ingoing', 50.0, 50.0, 17200, -235, -230, null, null),
  (15, 'BR-04', 'BR-0401', 'registered lease', true, -1200, 71200000, 5.0, 25.0, 'ingoing', 50.0, 50.0, 18500, null, null, null, null),
  (16, 'BR-05', 'BR-0501', 'registered lease', true, -600, 62500000, 5.0, 25.0, 'ingoing', 50.0, 50.0, 16400, null, null, null, null),
  (17, 'BR-06', 'BR-0601', 'lease', false, -1900, 65500000, 6.0, 30.0, 'ingoing', 0.0, 0.0, 17800, -25, -20, null, null),
  (18, 'BR-07', 'BR-0701', 'registered lease', true, -3100, 74200000, 5.0, 25.0, 'ingoing', 50.0, 50.0, 21300, null, null, null, null),
  (19, 'BR-08', 'BR-0801', 'lease', false, -2700, 59800000, 6.0, 30.0, 'ingoing', 0.0, 0.0, 17600, -65, -60, null, null),
  -- Pandanus Point, QLD: leases, 6% a year to 30% of the resale price; resident shares 70% of the resale
  (20, 'PP-01', 'PP-0101', 'lease', false, -4000, 33500000, 6.0, 30.0, 'resale', 70.0, 70.0, 12800, -760, -755, -700, -700),
  (21, 'PP-01', 'PP-0102', 'lease', false, -700, 52500000, 6.0, 30.0, 'resale', 70.0, 70.0, 16200, null, null, null, null),
  (22, 'PP-02', 'PP-0201', 'lease', false, -3000, 45200000, 6.0, 30.0, 'resale', 70.0, 70.0, 14400, -520, -515, null, null),
  (23, 'PP-03', 'PP-0301', 'lease', false, -2000, 57500000, 6.0, 30.0, 'resale', 70.0, 70.0, 17600, null, null, null, null),
  (24, 'PP-04', 'PP-0401', 'lease', false, -2600, 41800000, 6.0, 30.0, 'resale', 70.0, 70.0, 14900, -200, -200, null, null),
  (25, 'PP-05', 'PP-0501', 'lease', false, -1600, 37200000, 6.0, 30.0, 'resale', 70.0, 70.0, 13700, -40, -38, null, null),
  (26, 'PP-06', 'PP-0601', 'lease', false, -1300, 52800000, 6.0, 30.0, 'resale', 70.0, 70.0, 15800, null, null, null, null),
  (27, 'PP-07', 'PP-0701', 'lease', false, -3400, 48800000, 6.0, 30.0, 'resale', 70.0, 70.0, 15500, -260, -255, null, -31),
  (28, 'PP-07', 'PP-0702', 'lease', false, -45, 65500000, 6.0, 30.0, 'resale', 70.0, 70.0, 18400, null, null, null, null),
  (29, 'PP-08', 'PP-0801', 'lease', false, -450, 35500000, 6.0, 30.0, 'resale', 70.0, 70.0, 13100, null, null, null, null)
) as x(n, unit, number, kind, reg, settled, ingoing, dmf, cap, base, share, refurb, fee, ended, vacated, statement, paid)
join units u on u.code = x.unit
on conflict (id) do nothing;

insert into residents (id, contract_id, name, email, phone, born_on, next_of_kin, next_of_kin_phone, moved_out_on)
select ('40000000-0000-4000-8000-' || lpad(x.n::text, 12, '0'))::uuid, c.id, x.name, x.email, x.phone, x.born::date, x.nok, x.nok_phone,
  case when x.out then c.vacated_on end
from (values
  (1, 'KG-0101', 'Margaret Hughes', 'margaret.h@example.com', '07 555 0101', '1941-04-12', 'Sarah Hughes (daughter)', '021 555 0101', false),
  (2, 'KG-0101', 'Alan Hughes', null, '07 555 0101', '1939-11-02', 'Sarah Hughes (daughter)', '021 555 0101', false),
  (3, 'KG-0201', 'Doreen Ashby', null, null, '1930-02-17', 'Peter Ashby (son)', '021 555 0102', true),
  (4, 'KG-0202', 'Rewi Parata', 'rewi.p@example.com', '07 555 0103', '1946-08-09', 'Mere Parata (wife)', '07 555 0103', false),
  (5, 'KG-0202', 'Mere Parata', 'mere.p@example.com', '07 555 0103', '1948-01-23', 'Rewi Parata (husband)', '07 555 0103', false),
  (6, 'KG-0301', 'Colin Ferris', 'colin.f@example.com', '07 555 0104', '1944-06-30', 'Janet Ferris (daughter)', '027 555 0104', false),
  (7, 'KG-0401', 'Shirley Tan', 'shirley.t@example.com', '07 555 0105', '1936-12-14', 'Michael Tan (son)', '021 555 0105', false),
  (8, 'KG-0501', 'Bruce Kemp', 'bruce.k@example.com', '07 555 0106', '1949-03-03', 'Lynne Kemp (sister)', '027 555 0106', false),
  (9, 'KG-0601', 'Ngaire Wilson', null, '07 555 0107', '1933-07-19', 'Tom Wilson (son)', '021 555 0107', false),
  (10, 'KG-0701', 'Graham Pike', null, null, '1932-05-25', 'Estate of Graham Pike: Anna Pike (executor)', '027 555 0108', true),
  (11, 'KG-0801', 'Beverley Moore', null, null, '1935-09-11', 'Kate Moore (daughter)', '021 555 0109', true),
  (12, 'KG-0802', 'Ian Drummond', 'ian.d@example.com', '07 555 0110', '1950-10-01', 'Fiona Drummond (wife)', '07 555 0110', false),
  (13, 'KG-0802', 'Fiona Drummond', 'fiona.d@example.com', '07 555 0110', '1952-04-16', 'Ian Drummond (husband)', '07 555 0110', false),
  (14, 'BR-0101', 'Harold Briggs', null, null, '1929-01-08', 'Dianne Briggs (daughter)', '0412 555 101', true),
  (15, 'BR-0102', 'Judith Cole', 'judith.c@example.com', '02 5550 1102', '1947-02-27', 'Mark Cole (son)', '0412 555 102', false),
  (16, 'BR-0201', 'Peter Novak', 'peter.n@example.com', '02 5550 1103', '1943-08-21', 'Eva Novak (wife)', '02 5550 1103', false),
  (17, 'BR-0201', 'Eva Novak', null, '02 5550 1103', '1945-05-05', 'Peter Novak (husband)', '02 5550 1103', false),
  (18, 'BR-0301', 'Joan Whitfield', null, null, '1931-03-13', 'Rob Whitfield (son)', '0412 555 104', true),
  (19, 'BR-0401', 'Ray Delaney', 'ray.d@example.com', '02 5550 1105', '1945-11-28', 'Sue Delaney (daughter)', '0412 555 105', false),
  (20, 'BR-0501', 'Ann Kowalski', 'ann.k@example.com', '02 5550 1106', '1948-09-09', 'Tom Kowalski (son)', '0412 555 106', false),
  (21, 'BR-0601', 'Les Murray', null, null, '1934-12-01', 'Carol Murray (daughter)', '0412 555 107', true),
  (22, 'BR-0701', 'Geoff Barton', 'geoff.b@example.com', '02 5550 1108', '1940-06-15', 'Lyn Barton (wife)', '02 5550 1108', false),
  (23, 'BR-0701', 'Lyn Barton', 'lyn.b@example.com', '02 5550 1108', '1942-02-02', 'Geoff Barton (husband)', '02 5550 1108', false),
  (24, 'BR-0801', 'Mavis Reid', null, null, '1930-10-10', 'John Reid (son)', '0412 555 109', true),
  (25, 'PP-0101', 'Stan Keogh', null, null, '1928-04-04', 'Brenda Keogh (daughter)', '0412 555 201', true),
  (26, 'PP-0102', 'Robyn Carter', 'robyn.c@example.com', '07 5550 2102', '1950-07-07', 'Luke Carter (son)', '0412 555 202', false),
  (27, 'PP-0201', 'Dulcie Hart', null, null, '1933-01-30', 'Glen Hart (son)', '0412 555 203', true),
  (28, 'PP-0301', 'Barry Nguyen', 'barry.n@example.com', '07 5550 2104', '1946-03-22', 'Linh Nguyen (wife)', '07 5550 2104', false),
  (29, 'PP-0301', 'Linh Nguyen', 'linh.n@example.com', '07 5550 2104', '1948-12-12', 'Barry Nguyen (husband)', '07 5550 2104', false),
  (30, 'PP-0401', 'Noel Fraser', null, null, '1935-08-18', 'Kerry Fraser (daughter)', '0412 555 205', true),
  (31, 'PP-0501', 'Elaine Ward', null, '07 5550 2106', '1938-05-29', 'Paul Ward (son)', '0412 555 206', true),
  (32, 'PP-0601', 'Ken Ellis', 'ken.e@example.com', '07 5550 2107', '1944-09-03', 'Jo Ellis (daughter)', '0412 555 207', false),
  (33, 'PP-0701', 'Thelma Grant', null, null, '1931-06-06', 'Neil Grant (son)', '0412 555 208', true),
  (34, 'PP-0702', 'David Shaw', 'david.s@example.com', '07 5550 2109', '1951-01-17', 'Helen Shaw (wife)', '07 5550 2109', false),
  (35, 'PP-0702', 'Helen Shaw', 'helen.s@example.com', '07 5550 2109', '1953-03-08', 'David Shaw (husband)', '07 5550 2109', false),
  (36, 'PP-0801', 'Pat O''Brien', 'pat.ob@example.com', '07 5550 2110', '1947-10-24', 'Siobhan O''Brien (niece)', '0412 555 210', false)
) as x(n, contract, name, email, phone, born, nok, nok_phone, out)
join contracts c on c.number = x.contract
on conflict (id) do nothing;

-- Units coming back: valuations, refurbishment, advertising and the next resident.
insert into resales (id, unit_id, prior_contract_id, agreed_value_cents, agreed_value_on, valuation_cents, valuation_on, refurb_started_on, refurb_done_on, refurb_cost_cents,
  first_advertised_on, asking_cents, new_contract_id, sold_cents, sold_on, settled_on)
select ('50000000-0000-4000-8000-' || lpad(x.n::text, 12, '0'))::uuid, p.unit_id, p.id, x.agreed, current_date + x.agreed_on, null, null,
  current_date + x.refurb_start, current_date + x.refurb_done, x.refurb_cost, current_date + x.advertised, x.asking, nc.id, nc.ingoing_cents,
  case when nc.id is not null then nc.settled_on - 28 end, nc.settled_on
from (values
  (1, 'KG-0201', null::bigint, null::int, -1574, -1540, 2850000, -1535, 52900000, 'KG-0202'),
  (2, 'KG-0701', null, null, -62, null, 0, null, null, null),
  (3, 'KG-0801', null, null, -200, -170, 3120000, -165, 74500000, 'KG-0802'),
  (4, 'BR-0101', 78000000, -940, -944, -925, 2400000, -930, 79000000, 'BR-0102'),
  (5, 'BR-0301', null, null, -228, -205, 2650000, -200, 83500000, null),
  (6, 'BR-0601', null, null, -12, null, 0, null, null, null),
  (7, 'BR-0801', null, null, -58, -20, 1980000, null, null, null),
  (8, 'PP-0101', 52000000, -740, -754, -725, 2200000, -722, 52500000, 'PP-0102'),
  (9, 'PP-0201', 52000000, -500, -512, -485, 2410000, -480, 54000000, null),
  (10, 'PP-0401', 48000000, -185, -198, -172, 1960000, -170, 49500000, null),
  (11, 'PP-0701', 64000000, -240, -254, -150, 2780000, -140, 65500000, 'PP-0702')
) as x(n, prior, agreed, agreed_on, refurb_start, refurb_done, refurb_cost, advertised, asking, next_contract)
join contracts p on p.number = x.prior
left join contracts nc on nc.number = x.next_contract
on conflict (id) do nothing;

-- Weekly fees billed monthly for the last six months, each resident billed the share the rules allow.
insert into charges (contract_id, number, kind, period_start, period_end, full_cents, billed_cents, due_on)
select c.id, c.number || '-' || to_char(ms.month_start, 'YYYY-MM'), 'general services', p.start_on, p.end_on,
  round(c.weekly_fee_cents * ((p.end_on - p.start_on) + 1) / 7.0), round(round(c.weekly_fee_cents * ((p.end_on - p.start_on) + 1) / 7.0) * resident_fee_pct(c.id, p.start_on) / 100),
  p.start_on + 14
from contracts c
cross join generate_series(date_trunc('month', current_date) - interval '6 months', date_trunc('month', current_date), interval '1 month') as g(m)
cross join lateral (select g.m::date as month_start) ms
cross join lateral (select greatest(ms.month_start, c.settled_on) as start_on, (ms.month_start + interval '1 month' - interval '1 day')::date as end_on) p
where c.settled_on <= p.end_on and c.exit_paid_on is null
  and (c.vacated_on is null or p.start_on < c.vacated_on or resident_fee_pct(c.id, p.start_on) > 0)
on conflict (number) do nothing;

-- Fees paid two days early, except the arrears and anything a former resident owes (it comes off their exit entitlement).
update charges ch set paid_on = ch.due_on - 2
from contracts c
where c.id = ch.contract_id and ch.paid_on is null and ch.due_on < current_date and c.vacated_on is null
  and not (c.number = 'KG-0301' and ch.period_start >= (date_trunc('month', current_date) - interval '2 months')::date)
  and not (c.number = 'BR-0501' and ch.period_start >= (date_trunc('month', current_date) - interval '1 month')::date);

-- Two mistakes the record check catches: former residents billed in full past the cap.
update charges ch set billed_cents = ch.full_cents
from contracts c
where c.id = ch.contract_id and c.number in ('BR-0301', 'PP-0401') and ch.period_start >= (date_trunc('month', current_date) - interval '1 month')::date
  and ch.billed_cents < ch.full_cents and ch.billed_cents > 0;

update contracts c set exit_paid_cents = e.exit_cents from v_exits e where e.contract_id = c.id and c.exit_paid_on is not null and c.exit_paid_cents is null;

insert into maintenance (number, village_id, unit_id, reported_by, reported_on, category, priority, description, assigned_to, done_on, cost_cents, resident_pays)
select x.number, v.id, u.id, x.who, current_date + x.reported, x.category, x.priority, x.description, x.assigned, current_date + x.done, x.cost, x.resident_pays
from (values
  ('MR-1001', 'KG', 'KG-04', 'Shirley Tan', -3, 'plumbing', 'urgent', 'Hot water cylinder leaking into the hallway cupboard', 'Bay Plumbing (demo)', null::int, 0, false),
  ('MR-1002', 'KG', 'KG-01', 'Alan Hughes', -12, 'electrical', 'high', 'Bathroom heater not switching on', 'Kowhai maintenance', null, 0, false),
  ('MR-1003', 'KG', null, 'Residents committee', -40, 'grounds', 'normal', 'Path by the bowling green lifting; trip hazard by the bench', 'Kowhai maintenance', -20, 185000, false),
  ('MR-1004', 'KG', 'KG-06', 'Ngaire Wilson', -9, 'call bell', 'urgent', 'Pendant alarm not reaching the nurse station', 'Safe Call (demo)', -8, 22000, false),
  ('MR-1005', 'KG', 'KG-05', 'Bruce Kemp', -60, 'joinery', 'normal', 'Wardrobe door off its track', 'Kowhai maintenance', -51, 9500, false),
  ('MR-2001', 'BR', 'BR-02', 'Eva Novak', -35, 'roofing', 'normal', 'Gutter overflowing at the back door when it rains', 'Hornsby Roof & Gutter (demo)', null, 0, false),
  ('MR-2002', 'BR', 'BR-04', 'Ray Delaney', -5, 'appliances', 'normal', 'Oven element gone', 'Banksia maintenance', null, 0, true),
  ('MR-2003', 'BR', null, 'Greg Lawson', -90, 'pool', 'high', 'Pool pump replaced', 'AquaServ (demo)', -84, 412000, false),
  ('MR-2004', 'BR', 'BR-07', 'Lyn Barton', -21, 'plumbing', 'high', 'Shower mixer dripping constantly', 'Banksia maintenance', -16, 31000, false),
  ('MR-2005', 'BR', 'BR-05', 'Ann Kowalski', -2, 'security', 'urgent', 'Front door lock jammed, resident using the side door', 'Northside Locksmiths (demo)', null, 0, false),
  ('MR-3001', 'PP', 'PP-03', 'Barry Nguyen', -14, 'air conditioning', 'high', 'Split system in the bedroom blowing warm air', 'Coastal Air (demo)', -6, 26500, false),
  ('MR-3002', 'PP', 'PP-06', 'Ken Ellis', -45, 'painting', 'normal', 'Water stain on the lounge ceiling after the storm', 'Pandanus maintenance', null, 0, false),
  ('MR-3003', 'PP', null, 'Residents committee', -70, 'community centre', 'normal', 'Community centre dishwasher replaced', 'Pandanus maintenance', -55, 268000, false),
  ('MR-3004', 'PP', 'PP-08', 'Pat O''Brien', -4, 'grab rails', 'high', 'Grab rail beside the toilet loose', 'Pandanus maintenance', null, 0, false)
) as x(number, village, unit, who, reported, category, priority, description, assigned, done, cost, resident_pays)
join villages v on v.code = x.village left join units u on u.code = x.unit
on conflict (number) do nothing;

insert into enquiries (id, name, email, phone, village_id, wants, source, stage, first_contact_on, last_contact_on, next_step, next_step_on, lost_reason, contract_id)
select ('60000000-0000-4000-8000-' || lpad(x.n::text, 12, '0'))::uuid, x.name, x.email, x.phone, v.id, x.wants, x.source, x.stage,
  current_date + x.first, current_date + x.last, x.next_step, current_date + x.next_on, x.lost, c.id
from (values
  (1, 'Wendy and Ross Calder', 'calders@example.com', '07 555 0301', 'KG', '2 bedroom villa', 'website', 'toured', -30, -26, 'Send the KG-07 floor plan once the refurbishment is done', -5, null, null::text),
  (2, 'Hemi Tawhiri', null, '027 555 0302', 'KG', 'serviced apartment', 'open day', 'enquiry', -50, -48, null, null::int, null, null),
  (3, 'Lorraine Bell', 'lorraine.b@example.com', '021 555 0303', 'KG', '3 bedroom villa', 'referral from a resident', 'moved in', -200, -122, null, null, null, 'KG-0802'),
  (4, 'Vic and June Petrov', 'petrovs@example.com', '0412 555 304', 'BR', '2 bedroom villa', 'realestate listing', 'application', -40, -9, 'Book the financial adviser meeting before the deposit', 6, null, null),
  (5, 'Keith Lam', 'keith.l@example.com', '0412 555 305', 'BR', 'apartment', 'website', 'tour booked', -12, -12, 'Tour of BR-06 when the painters finish', -2, null, null),
  (6, 'Margaret Doyle', null, '02 5550 3306', 'BR', '2 bedroom villa', 'newspaper', 'lost', -150, -120, null, null, 'Chose a village closer to her daughter', null),
  (7, 'Bill Sanders', 'bill.s@example.com', '0412 555 307', 'PP', '2 bedroom villa', 'open day', 'toured', -25, -22, 'Call back about PP-02 price', -1, null, null),
  (8, 'Carol and Jim Hext', 'hexts@example.com', '0412 555 308', 'PP', 'villa', 'referral from a resident', 'deposit', -60, -3, 'Settlement booked for PP-04', 21, null, null),
  (9, 'Rosa Ferreira', null, '0412 555 309', 'PP', 'studio or 1 bedroom', 'website', 'enquiry', -6, -6, 'Send brochure and fee schedule', 1, null, null),
  (10, 'Neville Hunt', 'neville.h@example.com', '0412 555 310', 'PP', '3 bedroom villa', 'website', 'moved in', -110, -50, null, null, null, 'PP-0702')
) as x(n, name, email, phone, village, wants, source, stage, first, last, next_step, next_on, lost, contract)
join villages v on v.code = x.village left join contracts c on c.number = x.contract
on conflict (id) do nothing;

-- Last year's AGM at every village; this year's only at the two Australian ones.
insert into meetings (village_id, kind, held_on, notice_given_on, note)
select a.village_id, 'AGM', (a.year_end - interval '12 months' + interval '4 months')::date, (a.year_end - interval '12 months' + interval '4 months' - interval '14 days')::date,
  'Financial statements, supervisor report and maintenance report received'
from v_agm a
on conflict do nothing;
insert into meetings (village_id, kind, held_on, notice_given_on, note)
select a.village_id, 'AGM', (a.year_end + interval '3 months')::date, (a.year_end + interval '3 months' - interval '14 days')::date, 'Budget and maintenance report presented'
from v_agm a where a.jurisdiction <> 'NZ' and (a.year_end + interval '3 months')::date <= current_date
on conflict do nothing;
insert into meetings (village_id, kind, held_on, note)
select v.id, 'residents committee', current_date - 20, 'Garden levy, bus timetable, maintenance list reviewed'
from villages v
on conflict do nothing;

insert into notes (id, village_id, unit_id, contract_id, title, body)
select ('70000000-0000-4000-8000-' || lpad(x.n::text, 12, '0'))::uuid, u.village_id, u.id, c.id, x.title, x.body
from (values
  (1, 'KG-07', 'KG-0701', 'Estate', 'Executor Anna Pike asked when the estate will be paid. Explained it is paid when the unit is relicensed; refurbishment quote approved.'),
  (2, 'BR-03', 'BR-0301', 'Pricing', 'Two inspections, no offers at the asking price. Rob Whitfield (son) asked about the order process.'),
  (3, 'PP-02', 'PP-0201', 'Buy-back', 'Board to approve funding the buy-back if no sale by the 18 month date.')
) as x(n, unit, contract, title, body)
join units u on u.code = x.unit join contracts c on c.number = x.contract
on conflict (id) do nothing;
