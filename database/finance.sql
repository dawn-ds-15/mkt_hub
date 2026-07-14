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
(12,	'MONTH',	'2025-12',	3.90,	66.00,	'Financial settings for month 12',	1,	'2026-07-13 08:57:27.841603');

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

INSERT INTO "project_expenses" ("id", "project_id", "expense_month", "expense_year", "direct_cost", "direct_note", "overhead_cost", "overhead_note", "created_by", "created_at", "updated_at") VALUES
(1,	1,	1,	2024,	2050.00,	'Direct expense for infrastructure phase 1',	510.00,	'Overhead licensing cost 1',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(2,	2,	1,	2024,	2100.00,	'Direct expense for infrastructure phase 2',	520.00,	'Overhead licensing cost 2',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(3,	3,	1,	2024,	2150.00,	'Direct expense for infrastructure phase 3',	530.00,	'Overhead licensing cost 3',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(4,	4,	1,	2024,	2200.00,	'Direct expense for infrastructure phase 4',	540.00,	'Overhead licensing cost 4',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(5,	5,	1,	2024,	2250.00,	'Direct expense for infrastructure phase 5',	550.00,	'Overhead licensing cost 5',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(6,	6,	1,	2024,	2300.00,	'Direct expense for infrastructure phase 6',	560.00,	'Overhead licensing cost 6',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(7,	7,	1,	2024,	2350.00,	'Direct expense for infrastructure phase 7',	570.00,	'Overhead licensing cost 7',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(8,	8,	1,	2024,	2400.00,	'Direct expense for infrastructure phase 8',	580.00,	'Overhead licensing cost 8',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(9,	9,	1,	2024,	2450.00,	'Direct expense for infrastructure phase 9',	590.00,	'Overhead licensing cost 9',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(10,	10,	1,	2024,	2500.00,	'Direct expense for infrastructure phase 10',	600.00,	'Overhead licensing cost 10',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(11,	11,	1,	2024,	2550.00,	'Direct expense for infrastructure phase 11',	610.00,	'Overhead licensing cost 11',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(12,	12,	1,	2024,	2600.00,	'Direct expense for infrastructure phase 12',	620.00,	'Overhead licensing cost 12',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(13,	13,	1,	2024,	2650.00,	'Direct expense for infrastructure phase 13',	630.00,	'Overhead licensing cost 13',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(14,	14,	1,	2024,	2700.00,	'Direct expense for infrastructure phase 14',	640.00,	'Overhead licensing cost 14',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(15,	15,	1,	2024,	2750.00,	'Direct expense for infrastructure phase 15',	650.00,	'Overhead licensing cost 15',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(16,	16,	1,	2024,	2800.00,	'Direct expense for infrastructure phase 16',	660.00,	'Overhead licensing cost 16',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(17,	17,	1,	2024,	2850.00,	'Direct expense for infrastructure phase 17',	670.00,	'Overhead licensing cost 17',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(18,	18,	1,	2024,	2900.00,	'Direct expense for infrastructure phase 18',	680.00,	'Overhead licensing cost 18',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(19,	19,	1,	2024,	2950.00,	'Direct expense for infrastructure phase 19',	690.00,	'Overhead licensing cost 19',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(20,	20,	1,	2024,	3000.00,	'Direct expense for infrastructure phase 20',	700.00,	'Overhead licensing cost 20',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(21,	21,	1,	2024,	3050.00,	'Direct expense for infrastructure phase 21',	710.00,	'Overhead licensing cost 21',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(22,	22,	1,	2024,	3100.00,	'Direct expense for infrastructure phase 22',	720.00,	'Overhead licensing cost 22',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(23,	23,	1,	2024,	3150.00,	'Direct expense for infrastructure phase 23',	730.00,	'Overhead licensing cost 23',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(24,	24,	1,	2024,	3200.00,	'Direct expense for infrastructure phase 24',	740.00,	'Overhead licensing cost 24',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(25,	25,	1,	2024,	3250.00,	'Direct expense for infrastructure phase 25',	750.00,	'Overhead licensing cost 25',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(26,	26,	1,	2024,	3300.00,	'Direct expense for infrastructure phase 26',	760.00,	'Overhead licensing cost 26',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(27,	27,	1,	2024,	3350.00,	'Direct expense for infrastructure phase 27',	770.00,	'Overhead licensing cost 27',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(28,	28,	1,	2024,	3400.00,	'Direct expense for infrastructure phase 28',	780.00,	'Overhead licensing cost 28',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(29,	29,	1,	2024,	3450.00,	'Direct expense for infrastructure phase 29',	790.00,	'Overhead licensing cost 29',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(30,	30,	1,	2024,	3500.00,	'Direct expense for infrastructure phase 30',	800.00,	'Overhead licensing cost 30',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(31,	1,	2,	2024,	3550.00,	'Direct expense for infrastructure phase 31',	810.00,	'Overhead licensing cost 31',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(32,	2,	2,	2024,	3600.00,	'Direct expense for infrastructure phase 32',	820.00,	'Overhead licensing cost 32',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(33,	3,	2,	2024,	3650.00,	'Direct expense for infrastructure phase 33',	830.00,	'Overhead licensing cost 33',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(34,	4,	2,	2024,	3700.00,	'Direct expense for infrastructure phase 34',	840.00,	'Overhead licensing cost 34',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(35,	5,	2,	2024,	3750.00,	'Direct expense for infrastructure phase 35',	850.00,	'Overhead licensing cost 35',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(36,	6,	2,	2024,	3800.00,	'Direct expense for infrastructure phase 36',	860.00,	'Overhead licensing cost 36',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(37,	7,	2,	2024,	3850.00,	'Direct expense for infrastructure phase 37',	870.00,	'Overhead licensing cost 37',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(38,	8,	2,	2024,	3900.00,	'Direct expense for infrastructure phase 38',	880.00,	'Overhead licensing cost 38',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(39,	9,	2,	2024,	3950.00,	'Direct expense for infrastructure phase 39',	890.00,	'Overhead licensing cost 39',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(40,	10,	2,	2024,	4000.00,	'Direct expense for infrastructure phase 40',	900.00,	'Overhead licensing cost 40',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(41,	11,	2,	2024,	4050.00,	'Direct expense for infrastructure phase 41',	910.00,	'Overhead licensing cost 41',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(42,	12,	2,	2024,	4100.00,	'Direct expense for infrastructure phase 42',	920.00,	'Overhead licensing cost 42',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(43,	13,	2,	2024,	4150.00,	'Direct expense for infrastructure phase 43',	930.00,	'Overhead licensing cost 43',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(44,	14,	2,	2024,	4200.00,	'Direct expense for infrastructure phase 44',	940.00,	'Overhead licensing cost 44',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(45,	15,	2,	2024,	4250.00,	'Direct expense for infrastructure phase 45',	950.00,	'Overhead licensing cost 45',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(46,	16,	2,	2024,	4300.00,	'Direct expense for infrastructure phase 46',	960.00,	'Overhead licensing cost 46',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(47,	17,	2,	2024,	4350.00,	'Direct expense for infrastructure phase 47',	970.00,	'Overhead licensing cost 47',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(48,	18,	2,	2024,	4400.00,	'Direct expense for infrastructure phase 48',	980.00,	'Overhead licensing cost 48',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(49,	19,	2,	2024,	4450.00,	'Direct expense for infrastructure phase 49',	990.00,	'Overhead licensing cost 49',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(50,	20,	2,	2024,	4500.00,	'Direct expense for infrastructure phase 50',	1000.00,	'Overhead licensing cost 50',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(51,	21,	2,	2024,	4550.00,	'Direct expense for infrastructure phase 51',	1010.00,	'Overhead licensing cost 51',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(52,	22,	2,	2024,	4600.00,	'Direct expense for infrastructure phase 52',	1020.00,	'Overhead licensing cost 52',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(53,	23,	2,	2024,	4650.00,	'Direct expense for infrastructure phase 53',	1030.00,	'Overhead licensing cost 53',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(54,	24,	2,	2024,	4700.00,	'Direct expense for infrastructure phase 54',	1040.00,	'Overhead licensing cost 54',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(55,	25,	2,	2024,	4750.00,	'Direct expense for infrastructure phase 55',	1050.00,	'Overhead licensing cost 55',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(56,	26,	2,	2024,	4800.00,	'Direct expense for infrastructure phase 56',	1060.00,	'Overhead licensing cost 56',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(57,	27,	2,	2024,	4850.00,	'Direct expense for infrastructure phase 57',	1070.00,	'Overhead licensing cost 57',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(58,	28,	2,	2024,	4900.00,	'Direct expense for infrastructure phase 58',	1080.00,	'Overhead licensing cost 58',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(59,	29,	2,	2024,	4950.00,	'Direct expense for infrastructure phase 59',	1090.00,	'Overhead licensing cost 59',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(60,	30,	2,	2024,	5000.00,	'Direct expense for infrastructure phase 60',	1100.00,	'Overhead licensing cost 60',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(61,	1,	3,	2024,	5050.00,	'Direct expense for infrastructure phase 61',	1110.00,	'Overhead licensing cost 61',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(62,	2,	3,	2024,	5100.00,	'Direct expense for infrastructure phase 62',	1120.00,	'Overhead licensing cost 62',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(63,	3,	3,	2024,	5150.00,	'Direct expense for infrastructure phase 63',	1130.00,	'Overhead licensing cost 63',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(64,	4,	3,	2024,	5200.00,	'Direct expense for infrastructure phase 64',	1140.00,	'Overhead licensing cost 64',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(65,	5,	3,	2024,	5250.00,	'Direct expense for infrastructure phase 65',	1150.00,	'Overhead licensing cost 65',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(66,	6,	3,	2024,	5300.00,	'Direct expense for infrastructure phase 66',	1160.00,	'Overhead licensing cost 66',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(67,	7,	3,	2024,	5350.00,	'Direct expense for infrastructure phase 67',	1170.00,	'Overhead licensing cost 67',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(68,	8,	3,	2024,	5400.00,	'Direct expense for infrastructure phase 68',	1180.00,	'Overhead licensing cost 68',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(69,	9,	3,	2024,	5450.00,	'Direct expense for infrastructure phase 69',	1190.00,	'Overhead licensing cost 69',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(70,	10,	3,	2024,	5500.00,	'Direct expense for infrastructure phase 70',	1200.00,	'Overhead licensing cost 70',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(71,	11,	3,	2024,	5550.00,	'Direct expense for infrastructure phase 71',	1210.00,	'Overhead licensing cost 71',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(72,	12,	3,	2024,	5600.00,	'Direct expense for infrastructure phase 72',	1220.00,	'Overhead licensing cost 72',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(73,	13,	3,	2024,	5650.00,	'Direct expense for infrastructure phase 73',	1230.00,	'Overhead licensing cost 73',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(74,	14,	3,	2024,	5700.00,	'Direct expense for infrastructure phase 74',	1240.00,	'Overhead licensing cost 74',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(75,	15,	3,	2024,	5750.00,	'Direct expense for infrastructure phase 75',	1250.00,	'Overhead licensing cost 75',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(76,	16,	3,	2024,	5800.00,	'Direct expense for infrastructure phase 76',	1260.00,	'Overhead licensing cost 76',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(77,	17,	3,	2024,	5850.00,	'Direct expense for infrastructure phase 77',	1270.00,	'Overhead licensing cost 77',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(78,	18,	3,	2024,	5900.00,	'Direct expense for infrastructure phase 78',	1280.00,	'Overhead licensing cost 78',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(79,	19,	3,	2024,	5950.00,	'Direct expense for infrastructure phase 79',	1290.00,	'Overhead licensing cost 79',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(80,	20,	3,	2024,	6000.00,	'Direct expense for infrastructure phase 80',	1300.00,	'Overhead licensing cost 80',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(81,	21,	3,	2024,	6050.00,	'Direct expense for infrastructure phase 81',	1310.00,	'Overhead licensing cost 81',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(82,	22,	3,	2024,	6100.00,	'Direct expense for infrastructure phase 82',	1320.00,	'Overhead licensing cost 82',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(83,	23,	3,	2024,	6150.00,	'Direct expense for infrastructure phase 83',	1330.00,	'Overhead licensing cost 83',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(84,	24,	3,	2024,	6200.00,	'Direct expense for infrastructure phase 84',	1340.00,	'Overhead licensing cost 84',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(85,	25,	3,	2024,	6250.00,	'Direct expense for infrastructure phase 85',	1350.00,	'Overhead licensing cost 85',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(86,	26,	3,	2024,	6300.00,	'Direct expense for infrastructure phase 86',	1360.00,	'Overhead licensing cost 86',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(87,	27,	3,	2024,	6350.00,	'Direct expense for infrastructure phase 87',	1370.00,	'Overhead licensing cost 87',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(88,	28,	3,	2024,	6400.00,	'Direct expense for infrastructure phase 88',	1380.00,	'Overhead licensing cost 88',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(89,	29,	3,	2024,	6450.00,	'Direct expense for infrastructure phase 89',	1390.00,	'Overhead licensing cost 89',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(90,	30,	3,	2024,	6500.00,	'Direct expense for infrastructure phase 90',	1400.00,	'Overhead licensing cost 90',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(91,	1,	4,	2024,	6550.00,	'Direct expense for infrastructure phase 91',	1410.00,	'Overhead licensing cost 91',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(92,	2,	4,	2024,	6600.00,	'Direct expense for infrastructure phase 92',	1420.00,	'Overhead licensing cost 92',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(93,	3,	4,	2024,	6650.00,	'Direct expense for infrastructure phase 93',	1430.00,	'Overhead licensing cost 93',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(94,	4,	4,	2024,	6700.00,	'Direct expense for infrastructure phase 94',	1440.00,	'Overhead licensing cost 94',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(95,	5,	4,	2024,	6750.00,	'Direct expense for infrastructure phase 95',	1450.00,	'Overhead licensing cost 95',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(96,	6,	4,	2024,	6800.00,	'Direct expense for infrastructure phase 96',	1460.00,	'Overhead licensing cost 96',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(97,	7,	4,	2024,	6850.00,	'Direct expense for infrastructure phase 97',	1470.00,	'Overhead licensing cost 97',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(98,	8,	4,	2024,	6900.00,	'Direct expense for infrastructure phase 98',	1480.00,	'Overhead licensing cost 98',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(99,	9,	4,	2024,	6950.00,	'Direct expense for infrastructure phase 99',	1490.00,	'Overhead licensing cost 99',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(100,	10,	4,	2024,	7000.00,	'Direct expense for infrastructure phase 100',	1500.00,	'Overhead licensing cost 100',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(101,	11,	4,	2024,	7050.00,	'Direct expense for infrastructure phase 101',	1510.00,	'Overhead licensing cost 101',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(102,	12,	4,	2024,	7100.00,	'Direct expense for infrastructure phase 102',	1520.00,	'Overhead licensing cost 102',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(103,	13,	4,	2024,	7150.00,	'Direct expense for infrastructure phase 103',	1530.00,	'Overhead licensing cost 103',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(104,	14,	4,	2024,	7200.00,	'Direct expense for infrastructure phase 104',	1540.00,	'Overhead licensing cost 104',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(105,	15,	4,	2024,	7250.00,	'Direct expense for infrastructure phase 105',	1550.00,	'Overhead licensing cost 105',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(106,	16,	4,	2024,	7300.00,	'Direct expense for infrastructure phase 106',	1560.00,	'Overhead licensing cost 106',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(107,	17,	4,	2024,	7350.00,	'Direct expense for infrastructure phase 107',	1570.00,	'Overhead licensing cost 107',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(108,	18,	4,	2024,	7400.00,	'Direct expense for infrastructure phase 108',	1580.00,	'Overhead licensing cost 108',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(109,	19,	4,	2024,	7450.00,	'Direct expense for infrastructure phase 109',	1590.00,	'Overhead licensing cost 109',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(110,	20,	4,	2024,	7500.00,	'Direct expense for infrastructure phase 110',	1600.00,	'Overhead licensing cost 110',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(111,	21,	4,	2024,	7550.00,	'Direct expense for infrastructure phase 111',	1610.00,	'Overhead licensing cost 111',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(112,	22,	4,	2024,	7600.00,	'Direct expense for infrastructure phase 112',	1620.00,	'Overhead licensing cost 112',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(113,	23,	4,	2024,	7650.00,	'Direct expense for infrastructure phase 113',	1630.00,	'Overhead licensing cost 113',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(114,	24,	4,	2024,	7700.00,	'Direct expense for infrastructure phase 114',	1640.00,	'Overhead licensing cost 114',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(115,	25,	4,	2024,	7750.00,	'Direct expense for infrastructure phase 115',	1650.00,	'Overhead licensing cost 115',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(116,	26,	4,	2024,	7800.00,	'Direct expense for infrastructure phase 116',	1660.00,	'Overhead licensing cost 116',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(117,	27,	4,	2024,	7850.00,	'Direct expense for infrastructure phase 117',	1670.00,	'Overhead licensing cost 117',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(118,	28,	4,	2024,	7900.00,	'Direct expense for infrastructure phase 118',	1680.00,	'Overhead licensing cost 118',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(119,	29,	4,	2024,	7950.00,	'Direct expense for infrastructure phase 119',	1690.00,	'Overhead licensing cost 119',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095'),
(120,	30,	4,	2024,	8000.00,	'Direct expense for infrastructure phase 120',	1700.00,	'Overhead licensing cost 120',	NULL,	'2026-07-13 08:56:03.073095',	'2026-07-13 08:56:03.073095');

ALTER TABLE ONLY "finance"."expense_settings" ADD CONSTRAINT "expense_settings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES core.members(id);

ALTER TABLE ONLY "finance"."project_expenses" ADD CONSTRAINT "project_expenses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES core.members(id);
ALTER TABLE ONLY "finance"."project_expenses" ADD CONSTRAINT "project_expenses_project_id_fkey" FOREIGN KEY (project_id) REFERENCES core.projects(id) ON DELETE CASCADE;

-- 2026-07-13 09:24:19 UTC
