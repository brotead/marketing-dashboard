-- Google Ads campaigns — Marzo 2026
-- Presupuestos en $0 hasta confirmar con los Excel. Editables desde la app.

insert into budgets (campaign_id, year, month, campaign_name, client_name, source, account_id, budget_total, paused) values
('bb_g1',   2026, 3, 'BB | Búsqueda | General',                     'BB',        'google_ads', '959-198-0482', 0, false),
('maf_g1',  2026, 3, 'Mafralac | Búsqueda | General',               'MAFRALAC',  'google_ads', '341-792-1164', 0, false),
('ami_g1',  2026, 3, 'Amipack | Búsqueda | General',                'AMIPACK',   'google_ads', '697-675-9472', 0, false),
('chi_g1',  2026, 3, 'Chialvo | Búsqueda | General',                'CHIALVO',   'google_ads', '321-694-5166', 0, false),
('fru_g1',  2026, 3, 'Frusso | Búsqueda | General',                 'FRUSSO',    'google_ads', '889-110-3405', 0, false),
('hsf_g1',  2026, 3, 'HSF | Búsqueda | General',                    'HSF',       'google_ads', '186-061-8452', 0, false),
('evo_g1',  2026, 3, 'Evora | Búsqueda | General',                  'EVORA',     'google_ads', '887-006-2293', 0, false),
('dur_g1',  2026, 3, 'Duraplas | Búsqueda | General',               'DURAPLAS',  'google_ads', '118-950-9678', 0, false),
('bis_g1',  2026, 3, 'Bisignano | Búsqueda | General',              'BISIGNANO', 'google_ads', '668-528-3246', 0, false)
on conflict (campaign_id, year, month) do nothing;
