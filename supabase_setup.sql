-- ── Crear tablas ──────────────────────────────────────────────────────────────

create table if not exists budgets (
  campaign_id   text    not null,
  year          integer not null,
  month         integer not null,
  campaign_name text    not null,
  client_name   text    not null,
  source        text    not null default 'facebook',
  account_id    text    not null,
  budget_total  numeric not null default 0,
  paused        boolean not null default false,
  primary key (campaign_id, year, month)
);

create table if not exists goals (
  client_name      text    not null,
  year             integer not null,
  month            integer not null,
  kpi              text    not null,
  goal_value       numeric not null default 0,
  current_override numeric,
  primary key (client_name, year, month, kpi)
);

-- ── Cargar datos actuales ──────────────────────────────────────────────────────

insert into budgets (campaign_id, year, month, campaign_name, client_name, source, account_id, budget_total, paused) values
('bb_1',   2026, 3, 'BB | AO | Interaccion | Rotomoldeo',           'BB',       'facebook', '6060428597350960', 330000,  false),
('bb_2',   2026, 3, 'BB | AO | Tráfico a IG | Seguidores',          'BB',       'facebook', '6060428597350960', 45000,   false),
('bb_3',   2026, 3, 'BB | Interaccion | Bebederos',                 'BB',       'facebook', '6060428597350960', 205000,  false),
('bb_4',   2026, 3, 'BB | Interaccion | Países limitrofes',         'BB',       'facebook', '6060428597350960', 300000,  false),
('bb_5',   2026, 3, 'BB | Interaccion | Expoagro',                  'BB',       'facebook', '6060428597350960', 20000,   true),
('hsf_1',  2026, 3, 'AO | Provincias | Mangueras | WA 7062',        'HSF',      'facebook', '1093035255361568', 80000,   false),
('hsf_2',  2026, 3, 'AO | Provincias | Divisiones móviles | WA 3690','HSF',     'facebook', '1093035255361568', 160000,  false),
('hsf_3',  2026, 3, 'AO | Provincias | Acoples | WA 7062',          'HSF',      'facebook', '1093035255361568', 160000,  false),
('maf_1',  2026, 3, 'Franz | Alcance',                              'MAFRALAC', 'facebook', '1176825600926277', 45000,   false),
('maf_2',  2026, 3, 'Franz | Tráfico a IG',                         'MAFRALAC', 'facebook', '1176825600926277', 310000,  false),
('maf_3',  2026, 3, 'Mafralac | Mensajes - clientes potenciales',   'MAFRALAC', 'facebook', '1176825600926277', 45000,   false),
('dur_1',  2026, 3, 'Duraplas | AO | Interacción | Mensajes WA',    'DURAPLAS', 'facebook', '1280174358781483', 450000,  false),
('dur_2',  2026, 3, 'Duraplas | Tráfico IG | Seguidores',           'DURAPLAS', 'facebook', '1280174358781483', 50000,   false),
('fru_1',  2026, 3, 'Frusso - Trafico IG',                          'FRUSSO',   'facebook', '354272955380102',  155000,  false),
('frus_1', 2026, 3, 'Frusso | Mensajes WPP',                        'FRUSSO',   'facebook', '354272955380102',  45000,   false),
('evo_1',  2026, 3, 'Evora | Mensajes AON',                         'EVORA',    'facebook', '1603903067656966', 500000,  false),
('evo_2',  2026, 3, 'Evora | Ventas AON',                           'EVORA',    'facebook', '1603903067656966', 500000,  false),
('ami_1',  2026, 3, 'Posteos promocionados | Tráfico a IG',         'AMIPACK',  'facebook', '1501279357908771', 50000,   false),
('ami_2',  2026, 3, 'Posteos promocionados | Tráfico a FB',         'AMIPACK',  'facebook', '1501279357908771', 50000,   false),
('chi_1',  2026, 3, 'Chialvo | Tráfico a IG',                       'CHIALVO',  'facebook', '1023685753258270', 100000,  false),
('nut_1',  2026, 3, 'Nutriar | Tráfico a IG',                       'NUTRIAR',  'facebook', '1688279834566905', 1000000, false)
on conflict (campaign_id, year, month) do nothing;

insert into goals (client_name, year, month, kpi, goal_value, current_override) values
('BB', 2026, 3, 'mensajes', 300, null)
on conflict (client_name, year, month, kpi) do nothing;
