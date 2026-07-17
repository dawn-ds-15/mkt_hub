-- Adminer 5.4.2 PostgreSQL 16.14 dump

DROP TABLE IF EXISTS "expense_settings";
DROP SEQUENCE IF EXISTS "finance".expense_settings_id_seq;
CREATE SEQUENCE "finance".expense_settings_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "finance"."expense_settings" (
    "id" bigint DEFAULT nextval('expense_settings_id_seq') NOT NULL,
    "period_type" character varying(20) NOT NULL,
    "period_value" character varying(20) NOT NULL,
    "churn_rate" numeric(5,2) NOT NULL,
    "gross_margin" numeric(5,2) NOT NULL,
    "note" text,
    "created_by" bigint,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expense_settings_period_type_check" CHECK ((((period_type)::text = ANY ((ARRAY['MONTH'::character varying, 'QUARTER'::character varying, 'YEAR'::character varying])::text[]))))
)
WITH (oids = false);

TRUNCATE "expense_settings";
INSERT INTO "expense_settings" ("id", "period_type", "period_value", "churn_rate", "gross_margin", "note", "created_by", "created_at") VALUES
(1,	'MONTH',	'2025-01',	1.70,	60.50,	'Financial settings for month 1',	1,	'2026-07-13 08:57:27.841603'),
(2,	'MONTH',	'2025-02',	1.90,	61.00,	'Financial settings for month 2',	1,	'2026-07-13 08:57:27.841603'),
(3,	'MONTH',	'2025-03',	2.10,	61.50,	'Financial settings for month 3',	1,	'2026-07-13 08:57:27.841603'),
(4,	'MONTH',	'2025-04',	2.30,	62.00,	'Financial settings for month 4',	1,	'2026-07-13 08:57:27.841603'),
(5,	'MONTH',	'2025-05',	2.50,	62.50,	'Financial settings for month 5',	1,	'2026-07-13 08:57:27.841603'),
(6,	'MONTH',	'2025-06',	2.70,	63.00,	'Financial settings for month 6',	1,	'2026-07-13 08:57:27.841603'),
(7,	'MONTH',	'2025-07',	2.90,	63.50,	'Financial settings for month 7',	1,	'2026-07-13 08:57:27.841603'),
(8,	'MONTH',	'2025-08',	3.10,	64.00,	'Financial settings for month 8',	1,	'2026-07-13 08:57:27.841603'),
(9,	'MONTH',	'2025-09',	3.30,	64.50,	'Financial settings for month 9',	1,	'2026-07-13 08:57:27.841603'),
(10,	'MONTH',	'2025-10',	3.50,	65.00,	'Financial settings for month 10',	1,	'2026-07-13 08:57:27.841603'),
(11,	'MONTH',	'2025-11',	3.70,	65.50,	'Financial settings for month 11',	1,	'2026-07-13 08:57:27.841603'),
(12,	'MONTH',	'2025-12',	3.90,	66.00,	'Financial settings for month 12',	1,	'2026-07-13 08:57:27.841603'),
(13,	'MONTH',	'2024-01',	1.50,	59.50,	'Financial settings for month 1 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(14,	'MONTH',	'2024-02',	1.70,	60.00,	'Financial settings for month 2 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(15,	'MONTH',	'2024-03',	1.90,	60.50,	'Financial settings for month 3 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(16,	'MONTH',	'2024-04',	2.10,	61.00,	'Financial settings for month 4 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(17,	'MONTH',	'2024-05',	2.30,	61.50,	'Financial settings for month 5 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(18,	'MONTH',	'2024-06',	2.50,	62.00,	'Financial settings for month 6 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(19,	'MONTH',	'2024-07',	2.70,	62.50,	'Financial settings for month 7 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(20,	'MONTH',	'2024-08',	2.90,	63.00,	'Financial settings for month 8 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(21,	'MONTH',	'2024-09',	3.10,	63.50,	'Financial settings for month 9 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(22,	'MONTH',	'2024-10',	3.30,	64.00,	'Financial settings for month 10 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(23,	'MONTH',	'2024-11',	3.50,	64.50,	'Financial settings for month 11 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(24,	'MONTH',	'2024-12',	3.70,	65.00,	'Financial settings for month 12 of 2024',	1,	'2026-07-13 08:57:27.841603'),
(25,	'MONTH',	'2026-01',	1.80,	61.00,	'Financial settings for month 1 of 2026',	1,	'2026-07-17 09:00:00'),
(26,	'MONTH',	'2026-02',	2.00,	61.50,	'Financial settings for month 2 of 2026',	1,	'2026-07-17 09:00:00'),
(27,	'MONTH',	'2026-03',	2.20,	62.00,	'Financial settings for month 3 of 2026',	1,	'2026-07-17 09:00:00'),
(28,	'MONTH',	'2026-04',	2.40,	62.50,	'Financial settings for month 4 of 2026',	1,	'2026-07-17 09:00:00'),
(29,	'MONTH',	'2026-05',	2.60,	63.00,	'Financial settings for month 5 of 2026',	1,	'2026-07-17 09:00:00'),
(30,	'MONTH',	'2026-06',	2.80,	63.50,	'Financial settings for month 6 of 2026',	1,	'2026-07-17 09:00:00'),
(31,	'MONTH',	'2026-07',	3.00,	64.00,	'Financial settings for month 7 of 2026',	1,	'2026-07-17 09:00:00'),
(32,	'MONTH',	'2026-08',	3.20,	64.50,	'Financial settings for month 8 of 2026',	1,	'2026-07-17 09:00:00'),
(33,	'MONTH',	'2026-09',	3.40,	65.00,	'Financial settings for month 9 of 2026',	1,	'2026-07-17 09:00:00'),
(34,	'MONTH',	'2026-10',	3.60,	65.50,	'Financial settings for month 10 of 2026',	1,	'2026-07-17 09:00:00'),
(35,	'MONTH',	'2026-11',	3.80,	66.00,	'Financial settings for month 11 of 2026',	1,	'2026-07-17 09:00:00'),
(36,	'MONTH',	'2026-12',	4.00,	66.50,	'Financial settings for month 12 of 2026',	1,	'2026-07-17 09:00:00');

DROP TABLE IF EXISTS "project_expenses";
DROP SEQUENCE IF EXISTS "finance".project_expenses_id_seq;
CREATE SEQUENCE "finance".project_expenses_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "finance"."project_expenses" (
    "id" bigint DEFAULT nextval('project_expenses_id_seq') NOT NULL,
    "project_id" bigint NOT NULL,
    "expense_month" smallint NOT NULL,
    "expense_year" smallint NOT NULL,
    "direct_cost" numeric(15,2) DEFAULT '0',
    "direct_note" text,
    "overhead_cost" numeric(15,2) DEFAULT '0',
    "overhead_note" text,
    "total_cost" numeric(15,2) GENERATED ALWAYS AS ((direct_cost + overhead_cost)) STORED,
    "created_by" bigint,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_expenses_expense_month_check" CHECK ((((expense_month >= 1) AND (expense_month <= 12))))
)
WITH (oids = false);

CREATE UNIQUE INDEX project_expenses_project_id_expense_month_expense_year_key ON finance.project_expenses USING btree (project_id, expense_month, expense_year);

CREATE INDEX idx_expense_project ON finance.project_expenses USING btree (project_id);

CREATE INDEX idx_expense_year ON finance.project_expenses USING btree (expense_year);

CREATE INDEX idx_expense_month ON finance.project_expenses USING btree (expense_month);

TRUNCATE "project_expenses";
INSERT INTO "project_expenses" ("id", "project_id", "expense_month", "expense_year", "direct_cost", "direct_note", "overhead_cost", "overhead_note", "created_by", "created_at", "updated_at") VALUES
(1,	1,	1,	2024,	5000.00,	'Delivery and implementation cost',	1200.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(2,	2,	1,	2024,	3200.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(3,	3,	1,	2024,	0.00,	NULL,	1800.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(4,	1,	2,	2024,	5025.00,	'Delivery and implementation cost',	1210.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(5,	2,	2,	2024,	3225.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(6,	3,	2,	2024,	0.00,	NULL,	1815.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(7,	1,	3,	2024,	5050.00,	'Delivery and implementation cost',	1220.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(8,	2,	3,	2024,	3250.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(9,	3,	3,	2024,	0.00,	NULL,	1830.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(10,	1,	4,	2024,	5075.00,	'Delivery and implementation cost',	1230.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(11,	2,	4,	2024,	3275.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(12,	3,	4,	2024,	0.00,	NULL,	1845.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(13,	1,	5,	2024,	5100.00,	'Delivery and implementation cost',	1240.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(14,	2,	5,	2024,	3300.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(15,	3,	5,	2024,	0.00,	NULL,	1860.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(16,	1,	6,	2024,	5125.00,	'Delivery and implementation cost',	1250.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(17,	2,	6,	2024,	3325.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(18,	3,	6,	2024,	0.00,	NULL,	1875.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(19,	1,	7,	2024,	5150.00,	'Delivery and implementation cost',	1260.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(20,	2,	7,	2024,	3350.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(21,	3,	7,	2024,	0.00,	NULL,	1890.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(22,	1,	8,	2024,	5175.00,	'Delivery and implementation cost',	1270.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(23,	2,	8,	2024,	3375.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(24,	3,	8,	2024,	0.00,	NULL,	1905.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(25,	1,	9,	2024,	5200.00,	'Delivery and implementation cost',	1280.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(26,	2,	9,	2024,	3400.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(27,	3,	9,	2024,	0.00,	NULL,	1920.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(28,	1,	10,	2024,	5225.00,	'Delivery and implementation cost',	1290.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(29,	2,	10,	2024,	3425.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(30,	3,	10,	2024,	0.00,	NULL,	1935.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(31,	1,	11,	2024,	5250.00,	'Delivery and implementation cost',	1300.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(32,	2,	11,	2024,	3450.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(33,	3,	11,	2024,	0.00,	NULL,	1950.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(34,	1,	12,	2024,	5275.00,	'Delivery and implementation cost',	1310.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(35,	2,	12,	2024,	3475.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(36,	3,	12,	2024,	0.00,	NULL,	1965.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(37,	1,	1,	2025,	5300.00,	'Delivery and implementation cost',	1300.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(38,	2,	1,	2025,	3500.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(39,	3,	1,	2025,	0.00,	NULL,	1950.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(40,	1,	2,	2025,	5325.00,	'Delivery and implementation cost',	1310.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(41,	2,	2,	2025,	3525.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(42,	3,	2,	2025,	0.00,	NULL,	1965.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(43,	1,	3,	2025,	5350.00,	'Delivery and implementation cost',	1320.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(44,	2,	3,	2025,	3550.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(45,	3,	3,	2025,	0.00,	NULL,	1980.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(46,	1,	4,	2025,	5375.00,	'Delivery and implementation cost',	1330.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(47,	2,	4,	2025,	3575.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(48,	3,	4,	2025,	0.00,	NULL,	1995.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(49,	1,	5,	2025,	5400.00,	'Delivery and implementation cost',	1340.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(50,	2,	5,	2025,	3600.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(51,	3,	5,	2025,	0.00,	NULL,	2010.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(52,	1,	6,	2025,	5425.00,	'Delivery and implementation cost',	1350.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(53,	2,	6,	2025,	3625.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(54,	3,	6,	2025,	0.00,	NULL,	2025.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(55,	1,	7,	2025,	5450.00,	'Delivery and implementation cost',	1360.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(56,	2,	7,	2025,	3650.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(57,	3,	7,	2025,	0.00,	NULL,	2040.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(58,	1,	8,	2025,	5475.00,	'Delivery and implementation cost',	1370.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(59,	2,	8,	2025,	3675.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(60,	3,	8,	2025,	0.00,	NULL,	2055.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(61,	1,	9,	2025,	5500.00,	'Delivery and implementation cost',	1380.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(62,	2,	9,	2025,	3700.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(63,	3,	9,	2025,	0.00,	NULL,	2070.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(64,	1,	10,	2025,	5525.00,	'Delivery and implementation cost',	1390.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(65,	2,	10,	2025,	3725.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(66,	3,	10,	2025,	0.00,	NULL,	2085.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(67,	1,	11,	2025,	5550.00,	'Delivery and implementation cost',	1400.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(68,	2,	11,	2025,	3750.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(69,	3,	11,	2025,	0.00,	NULL,	2100.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(70,	1,	12,	2025,	5575.00,	'Delivery and implementation cost',	1410.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(71,	2,	12,	2025,	3775.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(72,	3,	12,	2025,	0.00,	NULL,	2115.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(73,	1,	1,	2026,	5600.00,	'Delivery and implementation cost',	1400.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(74,	2,	1,	2026,	3800.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(75,	3,	1,	2026,	0.00,	NULL,	2100.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(76,	1,	2,	2026,	5625.00,	'Delivery and implementation cost',	1410.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(77,	2,	2,	2026,	3825.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(78,	3,	2,	2026,	0.00,	NULL,	2115.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(79,	1,	3,	2026,	5650.00,	'Delivery and implementation cost',	1420.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(80,	2,	3,	2026,	3850.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(81,	3,	3,	2026,	0.00,	NULL,	2130.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(82,	1,	4,	2026,	5675.00,	'Delivery and implementation cost',	1430.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(83,	2,	4,	2026,	3875.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(84,	3,	4,	2026,	0.00,	NULL,	2145.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(85,	1,	5,	2026,	5700.00,	'Delivery and implementation cost',	1440.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(86,	2,	5,	2026,	3900.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(87,	3,	5,	2026,	0.00,	NULL,	2160.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(88,	1,	6,	2026,	5725.00,	'Delivery and implementation cost',	1450.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(89,	2,	6,	2026,	3925.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(90,	3,	6,	2026,	0.00,	NULL,	2175.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(91,	1,	7,	2026,	5750.00,	'Delivery and implementation cost',	1460.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(92,	2,	7,	2026,	3950.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(93,	3,	7,	2026,	0.00,	NULL,	2190.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(94,	1,	8,	2026,	5775.00,	'Delivery and implementation cost',	1470.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(95,	2,	8,	2026,	3975.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(96,	3,	8,	2026,	0.00,	NULL,	2205.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(97,	1,	9,	2026,	5800.00,	'Delivery and implementation cost',	1480.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(98,	2,	9,	2026,	4000.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(99,	3,	9,	2026,	0.00,	NULL,	2220.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(100,	1,	10,	2026,	5825.00,	'Delivery and implementation cost',	1490.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(101,	2,	10,	2026,	4025.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(102,	3,	10,	2026,	0.00,	NULL,	2235.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(103,	1,	11,	2026,	5850.00,	'Delivery and implementation cost',	1500.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(104,	2,	11,	2026,	4050.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(105,	3,	11,	2026,	0.00,	NULL,	2250.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(106,	1,	12,	2026,	5875.00,	'Delivery and implementation cost',	1510.00,	'Software and administration overhead',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(107,	2,	12,	2026,	4075.00,	'Direct-only project expense',	0.00,	NULL,	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151'),
(108,	3,	12,	2026,	0.00,	NULL,	2265.00,	'Overhead-only project expense',	1,	'2026-07-17 08:20:47.917151',	'2026-07-17 08:20:47.917151');

ALTER TABLE ONLY "finance"."expense_settings" ADD CONSTRAINT "expense_settings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES core.members(id);

ALTER TABLE ONLY "finance"."project_expenses" ADD CONSTRAINT "project_expenses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES core.members(id);
ALTER TABLE ONLY "finance"."project_expenses" ADD CONSTRAINT "project_expenses_project_id_fkey" FOREIGN KEY (project_id) REFERENCES core.projects(id) ON DELETE CASCADE;

-- 2026-07-17 08:29:43 UTC
