SET search_path TO core, public;

-- Drop dependent tables first so this seed can be rerun safely.
DROP TABLE IF EXISTS marketing.closed_deals;
DROP TABLE IF EXISTS marketing.opportunities;
DROP TABLE IF EXISTS finance.project_expenses;
DROP TABLE IF EXISTS finance.expense_settings;
DROP TABLE IF EXISTS sys_admin.audit_logs;
DROP TABLE IF EXISTS sys_admin.backups;
DROP TABLE IF EXISTS sys_admin.export_logs;
DROP TABLE IF EXISTS sys_admin.import_logs;

DROP TABLE IF EXISTS core.task_stakeholders;
DROP TABLE IF EXISTS core.tasks;
DROP TABLE IF EXISTS core.projects;
DROP TABLE IF EXISTS core.members;
DROP TABLE IF EXISTS core.dropdowns;

-- Adminer 5.4.2 PostgreSQL 16.14 dump

DROP TABLE IF EXISTS "dropdowns";
DROP SEQUENCE IF EXISTS "core".dropdowns_id_seq;
CREATE SEQUENCE "core".dropdowns_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "core"."dropdowns" (
    "id" integer DEFAULT nextval('dropdowns_id_seq') NOT NULL,
    "category" character varying(50) NOT NULL,
    "value" character varying(100) NOT NULL,
    "sort_order" integer DEFAULT '0',
    "is_active" boolean DEFAULT true,
    "is_system" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dropdowns_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_dropdown_category ON core.dropdowns USING btree (category);
CREATE UNIQUE INDEX dropdowns_category_value_unique ON core.dropdowns USING btree (category, value);

TRUNCATE "dropdowns";
INSERT INTO "dropdowns" ("id", "category", "value", "sort_order", "is_active", "is_system", "created_at") VALUES
(1,	'project_status',	'Planning',	1,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(2,	'project_status',	'Active',	2,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(3,	'project_status',	'On Hold',	3,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(4,	'project_status',	'Completed',	4,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(5,	'project_status',	'Cancelled',	5,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(6,	'task_status',	'To Do',	1,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(7,	'task_status',	'In Progress',	2,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(8,	'task_status',	'Review',	3,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(9,	'task_status',	'Done',	4,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(10,	'task_priority',	'Low',	1,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(11,	'task_priority',	'Medium',	2,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(12,	'task_priority',	'High',	3,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(13,	'task_priority',	'Critical',	4,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(14,	'project_type',	'Internal',	1,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(15,	'project_type',	'Client',	2,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(16,	'project_type',	'Research',	3,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(17,	'company_size',	'Startup',	1,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(18,	'company_size',	'SME',	2,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(19,	'company_size',	'Enterprise',	3,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(20,	'stakeholder',	'Client',	1,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(21,	'stakeholder',	'Internal',	2,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(22,	'stakeholder',	'Partner',	3,	'1',	'1',	'2026-07-08 08:49:43.455966'),
(23,	'opportunity_status',	'Open',	1,	'1',	'1',	'2026-07-09 09:58:05.416311'),
(24,	'opportunity_status',	'Qualified',	2,	'1',	'1',	'2026-07-09 09:58:05.416311'),
(25,	'opportunity_status',	'Proposal',	3,	'1',	'1',	'2026-07-09 09:58:05.416311'),
(26,	'opportunity_status',	'Negotiation',	4,	'1',	'1',	'2026-07-09 09:58:05.416311'),
(27,	'opportunity_status',	'Won',	5,	'1',	'1',	'2026-07-09 09:58:05.416311'),
(28,	'opportunity_status',	'Lost',	6,	'1',	'1',	'2026-07-09 09:58:05.416311'),
(29,	'contract_status',	'Draft',	1,	'1',	'1',	'2026-07-09 09:58:23.910427'),
(30,	'contract_status',	'Pending Approval',	2,	'1',	'1',	'2026-07-09 09:58:23.910427'),
(31,	'contract_status',	'Signed',	3,	'1',	'1',	'2026-07-09 09:58:23.910427'),
(32,	'contract_status',	'Expired',	4,	'1',	'1',	'2026-07-09 09:58:23.910427'),
(33,	'contract_status',	'Cancelled',	5,	'1',	'1',	'2026-07-09 09:58:23.910427'),
(39,	'lead_source',	'Website',	1,	'1',	'1',	'2026-07-09 09:58:43.239734'),
(40,	'lead_source',	'Facebook',	2,	'1',	'1',	'2026-07-09 09:58:43.239734'),
(41,	'lead_source',	'Google Ads',	3,	'1',	'1',	'2026-07-09 09:58:43.239734'),
(42,	'lead_source',	'Referral',	4,	'1',	'1',	'2026-07-09 09:58:43.239734'),
(43,	'lead_source',	'Event',	5,	'1',	'1',	'2026-07-09 09:58:43.239734'),
(44,	'lead_source',	'Cold Call',	6,	'1',	'1',	'2026-07-09 09:58:43.239734'),
(45,	'lead_source',	'Other',	7,	'1',	'1',	'2026-07-09 09:58:43.239734'),
(46,	'currency',	'VND',	1,	'1',	'1',	'2026-07-09 09:59:01.473782'),
(47,	'currency',	'USD',	2,	'1',	'1',	'2026-07-09 09:59:01.473782');

DROP TABLE IF EXISTS "members";
DROP SEQUENCE IF EXISTS "core".members_id_seq;
CREATE SEQUENCE "core".members_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "core"."members" (
    "id" bigint DEFAULT nextval('members_id_seq') NOT NULL,
    "name" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "role" public.member_role NOT NULL,
    "avatar_url" text,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "password_hash" text,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE UNIQUE INDEX idx_members_email ON core.members USING btree (email);

TRUNCATE "members";
INSERT INTO "members" ("id", "name", "email", "role", "avatar_url", "is_active", "created_at", "password_hash", "updated_at") VALUES
(1,	'Nguyen Van A',	'a.nguyen@company.com',	'manager',	NULL,	'1',	'2026-07-13 08:40:09.230727',	NULL,	'2026-07-13 08:40:09.230727'),
(2,	'Tran Thi B',	'b.tran@company.com',	'manager',	NULL,	'1',	'2026-07-13 08:40:09.233592',	NULL,	'2026-07-13 08:40:09.233592'),
(3,	'Le Van C',	'c.le@company.com',	'manager',	NULL,	'1',	'2026-07-13 08:40:09.235345',	NULL,	'2026-07-13 08:40:09.235345'),
(8,	'Nguyen Minh H',	'h.nguyen@company.com',	'manager',	NULL,	'1',	'2026-07-13 08:40:09.239302',	NULL,	'2026-07-13 08:40:09.239302'),
(11,	'Bui Minh K',	'k.bui@company.com',	'manager',	NULL,	'1',	'2026-07-13 08:40:09.242411',	NULL,	'2026-07-13 08:40:09.242411'),
(4,	'Pham Minh D',	'd.pham@company.com',	'specialist',	NULL,	'1',	'2026-07-13 08:41:44.119449',	NULL,	'2026-07-13 08:41:44.119449'),
(5,	'Hoang Thi E',	'e.hoang@company.com',	'specialist',	NULL,	'1',	'2026-07-13 08:41:44.122284',	NULL,	'2026-07-13 08:41:44.122284'),
(6,	'Vu Hoang F',	'f.vu@company.com',	'specialist',	NULL,	'1',	'2026-07-13 08:41:44.124455',	NULL,	'2026-07-13 08:41:44.124455'),
(7,	'Do Thi G',	'g.do@company.com',	'specialist',	NULL,	'1',	'2026-07-13 08:41:44.126821',	NULL,	'2026-07-13 08:41:44.126821'),
(9,	'Tran Van I',	'i.tran@company.com',	'specialist',	NULL,	'1',	'2026-07-13 08:41:44.130471',	NULL,	'2026-07-13 08:41:44.130471'),
(10,	'Dang Thi J',	'j.dang@company.com',	'specialist',	NULL,	'1',	'2026-07-13 08:41:44.132531',	NULL,	'2026-07-13 08:41:44.132531'),
(12,	'Ngo Thi L',	'l.ngo@company.com',	'specialist',	NULL,	'1',	'2026-07-13 08:41:44.13538',	NULL,	'2026-07-13 08:41:44.13538');

DROP TABLE IF EXISTS "projects";
DROP SEQUENCE IF EXISTS "core".projects_id_seq;
CREATE SEQUENCE "core".projects_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "core"."projects" (
    "id" bigint DEFAULT nextval('projects_id_seq') NOT NULL,
    "project_name" character varying(255) NOT NULL,
    "project_type_id" bigint NOT NULL,
    "status_id" bigint NOT NULL,
    "owner_id" bigint NOT NULL,
    "description" text,
    "planned_start_date" date,
    "planned_end_date" date,
    "actual_start_date" date,
    "actual_end_date" date,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "budget_plan" numeric(15,2) DEFAULT '0',
    "actual_cost" numeric(15,2) DEFAULT '0',
    "archived_at" timestamp,
    "archived_by" bigint,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

CREATE INDEX idx_projects_owner ON core.projects USING btree (owner_id);

CREATE INDEX idx_projects_status ON core.projects USING btree (status_id);

CREATE INDEX idx_projects_type ON core.projects USING btree (project_type_id);

CREATE INDEX idx_projects_date ON core.projects USING btree (planned_start_date);

TRUNCATE "projects";
INSERT INTO "projects" ("id", "project_name", "project_type_id", "status_id", "owner_id", "description", "planned_start_date", "planned_end_date", "actual_start_date", "actual_end_date", "created_at", "updated_at", "budget_plan", "actual_cost") VALUES
(1,	'Warehouse AI Vision Phase 1',	14,	2,	2,	NULL,	'2024-01-15',	'2024-06-30',	NULL,	NULL,	'2026-07-13 08:45:13.269366',	'2026-07-13 08:45:13.269366',	0.00,	0.00),
(2,	'CRM Internal Phase 2',	14,	2,	11,	NULL,	'2024-02-01',	'2024-08-15',	NULL,	NULL,	'2026-07-13 08:45:13.27432',	'2026-07-13 08:45:13.27432',	0.00,	0.00),
(3,	'ERP Upgrade Core',	14,	4,	2,	NULL,	'2024-03-01',	'2024-12-20',	NULL,	NULL,	'2026-07-13 08:45:13.276691',	'2026-07-13 08:45:13.276691',	0.00,	0.00),
(4,	'Customer Portal Web',	15,	2,	11,	NULL,	'2024-05-10',	'2025-01-15',	NULL,	NULL,	'2026-07-13 08:45:13.278634',	'2026-07-13 08:45:13.278634',	0.00,	0.00),
(5,	'Finance Dashboard Enterprise',	14,	2,	2,	NULL,	'2024-06-01',	'2024-11-30',	NULL,	NULL,	'2026-07-13 08:45:13.280252',	'2026-07-13 08:45:13.280252',	0.00,	0.00),
(6,	'HR Management System v3',	14,	4,	11,	NULL,	'2024-01-10',	'2024-07-20',	NULL,	NULL,	'2026-07-13 08:45:13.281919',	'2026-07-13 08:45:13.281919',	0.00,	0.00),
(7,	'AI Chatbot Integration',	16,	2,	2,	NULL,	'2024-08-01',	'2025-02-28',	NULL,	NULL,	'2026-07-13 08:45:13.283662',	'2026-07-13 08:45:13.283662',	0.00,	0.00),
(8,	'Data Warehouse Modernization',	16,	2,	11,	NULL,	'2024-09-15',	'2025-04-30',	NULL,	NULL,	'2026-07-13 08:45:13.28522',	'2026-07-13 08:45:13.28522',	0.00,	0.00),
(9,	'Marketing Analytics Engine',	15,	2,	2,	NULL,	'2024-10-01',	'2025-03-15',	NULL,	NULL,	'2026-07-13 08:45:13.286656',	'2026-07-13 08:45:13.286656',	0.00,	0.00),
(10,	'Mobile CRM Android',	15,	1,	11,	NULL,	'2025-02-01',	'2025-08-31',	NULL,	NULL,	'2026-07-13 08:45:13.288099',	'2026-07-13 08:45:13.288099',	0.00,	0.00),
(11,	'Mobile CRM iOS',	15,	1,	2,	NULL,	'2025-02-15',	'2025-09-15',	NULL,	NULL,	'2026-07-13 08:45:13.289784',	'2026-07-13 08:45:13.289784',	0.00,	0.00),
(12,	'Warehouse AI Vision Optimization',	16,	2,	11,	NULL,	'2025-01-05',	'2025-06-30',	NULL,	NULL,	'2026-07-13 08:45:13.291659',	'2026-07-13 08:45:13.291659',	0.00,	0.00),
(13,	'FPT E-Commerce Gateway',	15,	4,	2,	NULL,	'2024-04-01',	'2024-10-15',	NULL,	NULL,	'2026-07-13 08:45:13.293485',	'2026-07-13 08:45:13.293485',	0.00,	0.00),
(14,	'Viettel Billing Connector',	15,	2,	11,	NULL,	'2024-11-01',	'2025-05-15',	NULL,	NULL,	'2026-07-13 08:45:13.29529',	'2026-07-13 08:45:13.29529',	0.00,	0.00),
(15,	'VinGroup Loyalty Platform',	15,	2,	2,	NULL,	'2024-12-01',	'2025-07-31',	NULL,	NULL,	'2026-07-13 08:45:13.297201',	'2026-07-13 08:45:13.297201',	0.00,	0.00),
(16,	'Shopee Delivery Sync v2',	15,	2,	11,	NULL,	'2025-01-10',	'2025-07-20',	NULL,	NULL,	'2026-07-13 08:45:13.299005',	'2026-07-13 08:45:13.299005',	0.00,	0.00),
(17,	'Lazada Merchant API v4',	15,	2,	2,	NULL,	'2025-02-01',	'2025-08-15',	NULL,	NULL,	'2026-07-13 08:45:13.300629',	'2026-07-13 08:45:13.300629',	0.00,	0.00),
(18,	'Tiki Warehouse Integration',	15,	2,	11,	NULL,	'2025-03-01',	'2025-10-31',	NULL,	NULL,	'2026-07-13 08:45:13.302481',	'2026-07-13 08:45:13.302481',	0.00,	0.00),
(19,	'MoMo QR Engine Upgrade',	15,	2,	2,	NULL,	'2025-03-15',	'2025-09-30',	NULL,	NULL,	'2026-07-13 08:45:13.304394',	'2026-07-13 08:45:13.304394',	0.00,	0.00),
(20,	'Techcombank Secure Gateway',	15,	4,	11,	NULL,	'2024-02-15',	'2024-11-15',	NULL,	NULL,	'2026-07-13 08:45:13.306283',	'2026-07-13 08:45:13.306283',	0.00,	0.00),
(21,	'MB Bank Retail API',	15,	2,	2,	NULL,	'2025-04-01',	'2025-12-15',	NULL,	NULL,	'2026-07-13 08:45:13.308072',	'2026-07-13 08:45:13.308072',	0.00,	0.00),
(22,	'Samsung Factory Analytics',	16,	2,	11,	NULL,	'2025-04-15',	'2025-11-30',	NULL,	NULL,	'2026-07-13 08:45:13.309904',	'2026-07-13 08:45:13.309904',	0.00,	0.00),
(23,	'ERP Upgrade Phase 2',	14,	1,	2,	NULL,	'2026-01-10',	'2026-08-30',	NULL,	NULL,	'2026-07-13 08:45:13.311704',	'2026-07-13 08:45:13.311704',	0.00,	0.00),
(24,	'Customer Portal Mobile App',	15,	1,	11,	NULL,	'2026-02-01',	'2026-09-30',	NULL,	NULL,	'2026-07-13 08:45:13.313095',	'2026-07-13 08:45:13.313095',	0.00,	0.00),
(25,	'Finance Forecasting Engine',	14,	1,	2,	NULL,	'2026-03-01',	'2026-11-15',	NULL,	NULL,	'2026-07-13 08:45:13.314453',	'2026-07-13 08:45:13.314453',	0.00,	0.00),
(26,	'HR Recruitment Funnel',	14,	1,	11,	NULL,	'2026-03-15',	'2026-08-15',	NULL,	NULL,	'2026-07-13 08:45:13.315864',	'2026-07-13 08:45:13.315864',	0.00,	0.00),
(27,	'AI Recommendation Model',	16,	1,	2,	NULL,	'2026-04-01',	'2026-12-31',	NULL,	NULL,	'2026-07-13 08:45:13.317726',	'2026-07-13 08:45:13.317726',	0.00,	0.00),
(28,	'Data Lakehouses Security',	16,	1,	11,	NULL,	'2026-05-01',	'2026-10-31',	NULL,	NULL,	'2026-07-13 08:45:13.319277',	'2026-07-13 08:45:13.319277',	0.00,	0.00),
(29,	'Marketing Campaign Predictor',	15,	1,	2,	NULL,	'2026-06-01',	'2026-11-30',	NULL,	NULL,	'2026-07-13 08:45:13.320577',	'2026-07-13 08:45:13.320577',	0.00,	0.00),
(30,	'Enterprise Service Bus v2',	14,	1,	11,	NULL,	'2026-07-01',	'2027-02-28',	NULL,	NULL,	'2026-07-13 08:45:13.321899',	'2026-07-13 08:45:13.321899',	0.00,	0.00);

DROP TABLE IF EXISTS "task_stakeholders";
CREATE TABLE "core"."task_stakeholders" (
    "task_id" bigint NOT NULL,
    "stakeholder_id" bigint NOT NULL,
    CONSTRAINT "task_stakeholders_pkey" PRIMARY KEY ("task_id", "stakeholder_id")
)
WITH (oids = false);

CREATE INDEX idx_taskstakeholder_task ON core.task_stakeholders USING btree (task_id);

CREATE INDEX idx_taskstakeholder_stakeholder ON core.task_stakeholders USING btree (stakeholder_id);

TRUNCATE "task_stakeholders";
INSERT INTO "task_stakeholders" ("task_id", "stakeholder_id") VALUES
(142,	20),
(54,	22),
(8,	20),
(49,	22),
(70,	20),
(32,	21),
(184,	20),
(140,	21),
(3,	22),
(193,	20),
(10,	20),
(154,	20),
(85,	20),
(107,	21),
(47,	20),
(165,	22),
(171,	22),
(136,	20),
(69,	22),
(86,	21),
(6,	22),
(42,	21),
(8,	21),
(166,	20),
(52,	20),
(181,	20),
(34,	20),
(185,	21),
(97,	20),
(9,	22),
(98,	21),
(48,	21),
(39,	21),
(113,	21),
(37,	20),
(93,	22),
(33,	22),
(66,	22),
(44,	20),
(152,	21),
(40,	20),
(87,	22),
(126,	22),
(108,	22),
(7,	22),
(177,	22),
(153,	22),
(36,	22),
(7,	20),
(50,	20),
(75,	22),
(12,	21),
(29,	20),
(30,	22),
(168,	22),
(38,	21),
(149,	21),
(27,	22),
(143,	21),
(61,	20),
(84,	22),
(91,	20),
(41,	21),
(45,	22),
(15,	21),
(175,	20),
(131,	21),
(109,	20),
(189,	22),
(106,	20),
(174,	22),
(117,	22),
(116,	21),
(20,	21),
(26,	21),
(62,	21),
(53,	21),
(43,	22),
(121,	20),
(42,	22),
(16,	20),
(123,	22),
(39,	22),
(115,	20),
(127,	20),
(24,	21),
(22,	20),
(10,	22),
(34,	22),
(79,	20),
(76,	20),
(73,	20),
(198,	22),
(25,	20),
(58,	20),
(28,	22),
(167,	21),
(16,	22),
(46,	22),
(119,	21),
(48,	22),
(118,	20),
(47,	21),
(31,	20),
(88,	20),
(182,	21),
(50,	21),
(99,	22),
(56,	21),
(151,	20),
(63,	22),
(51,	22),
(21,	22),
(129,	22),
(200,	21),
(19,	20),
(32,	20),
(95,	21),
(13,	20),
(170,	21),
(4,	20),
(90,	22),
(150,	22),
(11,	21),
(83,	21),
(82,	20),
(139,	20),
(124,	20),
(30,	21),
(146,	21),
(104,	21),
(72,	22),
(102,	22),
(169,	20),
(96,	22),
(23,	21),
(20,	20),
(132,	22),
(27,	21),
(17,	20),
(68,	21),
(158,	21),
(160,	20),
(33,	21),
(130,	20),
(186,	22),
(14,	20),
(28,	20),
(67,	20),
(183,	22),
(38,	20),
(5,	20),
(18,	21),
(192,	22),
(2,	21),
(94,	20),
(144,	22),
(101,	21),
(111,	22),
(155,	21),
(12,	22),
(36,	21),
(187,	20),
(6,	21),
(81,	22),
(176,	21),
(138,	22),
(114,	22),
(44,	21),
(15,	22),
(13,	22),
(31,	22),
(145,	20),
(112,	20),
(164,	21),
(17,	21),
(178,	20),
(147,	22),
(195,	22),
(37,	22),
(199,	20),
(180,	22),
(74,	21),
(103,	20),
(100,	20),
(14,	21),
(120,	22),
(78,	22),
(3,	21),
(21,	21),
(59,	21),
(18,	22),
(23,	20),
(163,	20),
(65,	21),
(43,	20),
(22,	22),
(137,	21),
(64,	20),
(196,	20),
(26,	20),
(11,	20),
(24,	22),
(122,	21),
(25,	22),
(161,	21),
(89,	21),
(141,	22),
(57,	22),
(45,	21),
(35,	21),
(9,	21),
(135,	22),
(105,	22),
(35,	20),
(191,	21),
(92,	21),
(188,	21),
(134,	21),
(71,	21),
(179,	21),
(172,	20),
(40,	22),
(194,	21),
(80,	21),
(1,	22),
(49,	20),
(190,	20),
(173,	21),
(162,	22),
(51,	21),
(2,	20),
(197,	21),
(157,	20),
(46,	20),
(125,	21),
(5,	21),
(148,	20),
(110,	21),
(29,	21),
(4,	22),
(159,	22),
(156,	22),
(55,	20),
(41,	20),
(19,	22),
(133,	20),
(128,	21),
(60,	22),
(77,	21);

DROP TABLE IF EXISTS "tasks";
DROP SEQUENCE IF EXISTS "core".tasks_id_seq;
CREATE SEQUENCE "core".tasks_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "core"."tasks" (
    "id" bigint DEFAULT nextval('tasks_id_seq') NOT NULL,
    "task_name" character varying(255) NOT NULL,
    "description" text,
    "project_id" bigint NOT NULL,
    "assignee_id" bigint NOT NULL,
    "status_id" bigint NOT NULL,
    "priority_id" bigint NOT NULL,
    "start_date" date,
    "due_date" date NOT NULL,
    "completed_date" date,
    "exec_week" smallint NOT NULL,
    "reason" text,
    "needed_support_bod" text,
    "link" text,
    "remark" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "archived_at" timestamp,
    "archived_by" bigint,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tasks_exec_week_check" CHECK ((((exec_week >= 1) AND (exec_week <= 53))))
)
WITH (oids = false);

CREATE INDEX idx_tasks_project ON core.tasks USING btree (project_id);

CREATE INDEX idx_tasks_assignee ON core.tasks USING btree (assignee_id);

CREATE INDEX idx_tasks_status ON core.tasks USING btree (status_id);

CREATE INDEX idx_tasks_priority ON core.tasks USING btree (priority_id);

CREATE INDEX idx_tasks_due ON core.tasks USING btree (due_date);

TRUNCATE "tasks";
INSERT INTO "tasks" ("id", "task_name", "description", "project_id", "assignee_id", "status_id", "priority_id", "start_date", "due_date", "completed_date", "exec_week", "reason", "needed_support_bod", "link", "remark", "created_at", "updated_at") VALUES
(1,	'Database Design',	NULL,	2,	2,	7,	11,	'2024-01-23',	'2024-03-04',	NULL,	2,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(2,	'API Development',	NULL,	3,	3,	8,	12,	'2024-01-26',	'2024-03-07',	NULL,	3,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(3,	'UI Design',	NULL,	4,	4,	9,	13,	'2024-01-29',	'2024-03-10',	NULL,	4,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(4,	'Authentication',	NULL,	5,	5,	6,	10,	'2024-02-01',	'2024-03-13',	NULL,	5,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(5,	'Dashboard',	NULL,	6,	6,	7,	11,	'2024-02-04',	'2024-03-16',	NULL,	6,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(6,	'Integration Testing',	NULL,	7,	7,	8,	12,	'2024-02-07',	'2024-03-19',	NULL,	7,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(7,	'Deployment',	NULL,	8,	8,	9,	13,	'2024-02-10',	'2024-03-22',	NULL,	8,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(8,	'UAT',	NULL,	9,	9,	6,	10,	'2024-02-13',	'2024-03-25',	NULL,	9,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(9,	'Production Release',	NULL,	10,	10,	7,	11,	'2024-02-16',	'2024-03-28',	NULL,	10,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(10,	'Requirement Analysis',	NULL,	11,	11,	8,	12,	'2024-02-19',	'2024-03-31',	NULL,	11,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(11,	'Database Design',	NULL,	12,	12,	9,	13,	'2024-02-22',	'2024-04-03',	NULL,	12,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(12,	'API Development',	NULL,	13,	1,	6,	10,	'2024-02-25',	'2024-04-06',	NULL,	13,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(13,	'UI Design',	NULL,	14,	2,	7,	11,	'2024-02-28',	'2024-04-09',	NULL,	14,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(14,	'Authentication',	NULL,	15,	3,	8,	12,	'2024-03-02',	'2024-04-12',	NULL,	15,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(15,	'Dashboard',	NULL,	16,	4,	9,	13,	'2024-03-05',	'2024-04-15',	NULL,	16,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(16,	'Integration Testing',	NULL,	17,	5,	6,	10,	'2024-03-08',	'2024-04-18',	NULL,	17,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(17,	'Deployment',	NULL,	18,	6,	7,	11,	'2024-03-11',	'2024-04-21',	NULL,	18,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(18,	'UAT',	NULL,	19,	7,	8,	12,	'2024-03-14',	'2024-04-24',	NULL,	19,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(19,	'Production Release',	NULL,	20,	8,	9,	13,	'2024-03-17',	'2024-04-27',	NULL,	20,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(20,	'Requirement Analysis',	NULL,	21,	9,	6,	10,	'2024-03-20',	'2024-04-30',	NULL,	21,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(21,	'Database Design',	NULL,	22,	10,	7,	11,	'2024-03-23',	'2024-05-03',	NULL,	22,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(22,	'API Development',	NULL,	23,	11,	8,	12,	'2024-03-26',	'2024-05-06',	NULL,	23,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(23,	'UI Design',	NULL,	24,	12,	9,	13,	'2024-03-29',	'2024-05-09',	NULL,	24,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(24,	'Authentication',	NULL,	25,	1,	6,	10,	'2024-04-01',	'2024-05-12',	NULL,	25,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(25,	'Dashboard',	NULL,	26,	2,	7,	11,	'2024-04-04',	'2024-05-15',	NULL,	26,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(26,	'Integration Testing',	NULL,	27,	3,	8,	12,	'2024-04-07',	'2024-05-18',	NULL,	27,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(27,	'Deployment',	NULL,	28,	4,	9,	13,	'2024-04-10',	'2024-05-21',	NULL,	28,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(28,	'UAT',	NULL,	29,	5,	6,	10,	'2024-04-13',	'2024-05-24',	NULL,	29,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(29,	'Production Release',	NULL,	30,	6,	7,	11,	'2024-04-16',	'2024-05-27',	NULL,	30,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(30,	'Requirement Analysis',	NULL,	1,	7,	8,	12,	'2024-04-19',	'2024-05-30',	NULL,	31,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(31,	'Database Design',	NULL,	2,	8,	9,	13,	'2024-04-22',	'2024-06-02',	NULL,	32,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(32,	'API Development',	NULL,	3,	9,	6,	10,	'2024-04-25',	'2024-06-05',	NULL,	33,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(33,	'UI Design',	NULL,	4,	10,	7,	11,	'2024-04-28',	'2024-06-08',	NULL,	34,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(34,	'Authentication',	NULL,	5,	11,	8,	12,	'2024-05-01',	'2024-06-11',	NULL,	35,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(35,	'Dashboard',	NULL,	6,	12,	9,	13,	'2024-05-04',	'2024-06-14',	NULL,	36,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(36,	'Integration Testing',	NULL,	7,	1,	6,	10,	'2024-05-07',	'2024-06-17',	NULL,	37,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(37,	'Deployment',	NULL,	8,	2,	7,	11,	'2024-05-10',	'2024-06-20',	NULL,	38,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(38,	'UAT',	NULL,	9,	3,	8,	12,	'2024-05-13',	'2024-06-23',	NULL,	39,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(39,	'Production Release',	NULL,	10,	4,	9,	13,	'2024-05-16',	'2024-06-26',	NULL,	40,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(40,	'Requirement Analysis',	NULL,	11,	5,	6,	10,	'2024-05-19',	'2024-06-29',	NULL,	41,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(41,	'Database Design',	NULL,	12,	6,	7,	11,	'2024-05-22',	'2024-07-02',	NULL,	42,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(42,	'API Development',	NULL,	13,	7,	8,	12,	'2024-05-25',	'2024-07-05',	NULL,	43,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(43,	'UI Design',	NULL,	14,	8,	9,	13,	'2024-05-28',	'2024-07-08',	NULL,	44,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(44,	'Authentication',	NULL,	15,	9,	6,	10,	'2024-05-31',	'2024-07-11',	NULL,	45,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(45,	'Dashboard',	NULL,	16,	10,	7,	11,	'2024-06-03',	'2024-07-14',	NULL,	46,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(46,	'Integration Testing',	NULL,	17,	11,	8,	12,	'2024-06-06',	'2024-07-17',	NULL,	47,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(47,	'Deployment',	NULL,	18,	12,	9,	13,	'2024-06-09',	'2024-07-20',	NULL,	48,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(48,	'UAT',	NULL,	19,	1,	6,	10,	'2024-06-12',	'2024-07-23',	NULL,	49,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(49,	'Production Release',	NULL,	20,	2,	7,	11,	'2024-06-15',	'2024-07-26',	NULL,	50,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(50,	'Requirement Analysis',	NULL,	21,	3,	8,	12,	'2024-06-18',	'2024-07-29',	NULL,	51,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(51,	'Database Design',	NULL,	22,	4,	9,	13,	'2024-06-21',	'2024-08-01',	NULL,	52,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(52,	'API Development',	NULL,	23,	5,	6,	10,	'2024-06-24',	'2024-08-04',	NULL,	1,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(53,	'UI Design',	NULL,	24,	6,	7,	11,	'2024-06-27',	'2024-08-07',	NULL,	2,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(54,	'Authentication',	NULL,	25,	7,	8,	12,	'2024-06-30',	'2024-08-10',	NULL,	3,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(55,	'Dashboard',	NULL,	26,	8,	9,	13,	'2024-07-03',	'2024-08-13',	NULL,	4,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(56,	'Integration Testing',	NULL,	27,	9,	6,	10,	'2024-07-06',	'2024-08-16',	NULL,	5,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(57,	'Deployment',	NULL,	28,	10,	7,	11,	'2024-07-09',	'2024-08-19',	NULL,	6,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(58,	'UAT',	NULL,	29,	11,	8,	12,	'2024-07-12',	'2024-08-22',	NULL,	7,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(59,	'Production Release',	NULL,	30,	12,	9,	13,	'2024-07-15',	'2024-08-25',	NULL,	8,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(60,	'Requirement Analysis',	NULL,	1,	1,	6,	10,	'2024-07-18',	'2024-08-28',	NULL,	9,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(61,	'Database Design',	NULL,	2,	2,	7,	11,	'2024-07-21',	'2024-08-31',	NULL,	10,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(62,	'API Development',	NULL,	3,	3,	8,	12,	'2024-07-24',	'2024-09-03',	NULL,	11,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(63,	'UI Design',	NULL,	4,	4,	9,	13,	'2024-07-27',	'2024-09-06',	NULL,	12,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(64,	'Authentication',	NULL,	5,	5,	6,	10,	'2024-07-30',	'2024-09-09',	NULL,	13,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(65,	'Dashboard',	NULL,	6,	6,	7,	11,	'2024-08-02',	'2024-09-12',	NULL,	14,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(66,	'Integration Testing',	NULL,	7,	7,	8,	12,	'2024-08-05',	'2024-09-15',	NULL,	15,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(67,	'Deployment',	NULL,	8,	8,	9,	13,	'2024-08-08',	'2024-09-18',	NULL,	16,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(68,	'UAT',	NULL,	9,	9,	6,	10,	'2024-08-11',	'2024-09-21',	NULL,	17,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(69,	'Production Release',	NULL,	10,	10,	7,	11,	'2024-08-14',	'2024-09-24',	NULL,	18,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(70,	'Requirement Analysis',	NULL,	11,	11,	8,	12,	'2024-08-17',	'2024-09-27',	NULL,	19,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(71,	'Database Design',	NULL,	12,	12,	9,	13,	'2024-08-20',	'2024-09-30',	NULL,	20,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(72,	'API Development',	NULL,	13,	1,	6,	10,	'2024-08-23',	'2024-10-03',	NULL,	21,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(73,	'UI Design',	NULL,	14,	2,	7,	11,	'2024-08-26',	'2024-10-06',	NULL,	22,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(74,	'Authentication',	NULL,	15,	3,	8,	12,	'2024-08-29',	'2024-10-09',	NULL,	23,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(75,	'Dashboard',	NULL,	16,	4,	9,	13,	'2024-09-01',	'2024-10-12',	NULL,	24,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(76,	'Integration Testing',	NULL,	17,	5,	6,	10,	'2024-09-04',	'2024-10-15',	NULL,	25,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(77,	'Deployment',	NULL,	18,	6,	7,	11,	'2024-09-07',	'2024-10-18',	NULL,	26,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(78,	'UAT',	NULL,	19,	7,	8,	12,	'2024-09-10',	'2024-10-21',	NULL,	27,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(79,	'Production Release',	NULL,	20,	8,	9,	13,	'2024-09-13',	'2024-10-24',	NULL,	28,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(80,	'Requirement Analysis',	NULL,	21,	9,	6,	10,	'2024-09-16',	'2024-10-27',	NULL,	29,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(81,	'Database Design',	NULL,	22,	10,	7,	11,	'2024-09-19',	'2024-10-30',	NULL,	30,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(82,	'API Development',	NULL,	23,	11,	8,	12,	'2024-09-22',	'2024-11-02',	NULL,	31,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(83,	'UI Design',	NULL,	24,	12,	9,	13,	'2024-09-25',	'2024-11-05',	NULL,	32,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(84,	'Authentication',	NULL,	25,	1,	6,	10,	'2024-09-28',	'2024-11-08',	NULL,	33,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(85,	'Dashboard',	NULL,	26,	2,	7,	11,	'2024-10-01',	'2024-11-11',	NULL,	34,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(86,	'Integration Testing',	NULL,	27,	3,	8,	12,	'2024-10-04',	'2024-11-14',	NULL,	35,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(87,	'Deployment',	NULL,	28,	4,	9,	13,	'2024-10-07',	'2024-11-17',	NULL,	36,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(88,	'UAT',	NULL,	29,	5,	6,	10,	'2024-10-10',	'2024-11-20',	NULL,	37,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(89,	'Production Release',	NULL,	30,	6,	7,	11,	'2024-10-13',	'2024-11-23',	NULL,	38,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(90,	'Requirement Analysis',	NULL,	1,	7,	8,	12,	'2024-10-16',	'2024-11-26',	NULL,	39,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(91,	'Database Design',	NULL,	2,	8,	9,	13,	'2024-10-19',	'2024-11-29',	NULL,	40,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(92,	'API Development',	NULL,	3,	9,	6,	10,	'2024-10-22',	'2024-12-02',	NULL,	41,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(93,	'UI Design',	NULL,	4,	10,	7,	11,	'2024-10-25',	'2024-12-05',	NULL,	42,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(94,	'Authentication',	NULL,	5,	11,	8,	12,	'2024-10-28',	'2024-12-08',	NULL,	43,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(95,	'Dashboard',	NULL,	6,	12,	9,	13,	'2024-10-31',	'2024-12-11',	NULL,	44,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(96,	'Integration Testing',	NULL,	7,	1,	6,	10,	'2024-11-03',	'2024-12-14',	NULL,	45,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(97,	'Deployment',	NULL,	8,	2,	7,	11,	'2024-11-06',	'2024-12-17',	NULL,	46,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(98,	'UAT',	NULL,	9,	3,	8,	12,	'2024-11-09',	'2024-12-20',	NULL,	47,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(99,	'Production Release',	NULL,	10,	4,	9,	13,	'2024-11-12',	'2024-12-23',	NULL,	48,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(100,	'Requirement Analysis',	NULL,	11,	5,	6,	10,	'2024-11-15',	'2024-12-26',	NULL,	49,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(101,	'Database Design',	NULL,	12,	6,	7,	11,	'2024-11-18',	'2024-12-29',	NULL,	50,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(102,	'API Development',	NULL,	13,	7,	8,	12,	'2024-11-21',	'2025-01-01',	NULL,	51,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(103,	'UI Design',	NULL,	14,	8,	9,	13,	'2024-11-24',	'2025-01-04',	NULL,	52,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(104,	'Authentication',	NULL,	15,	9,	6,	10,	'2024-11-27',	'2025-01-07',	NULL,	1,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(105,	'Dashboard',	NULL,	16,	10,	7,	11,	'2024-11-30',	'2025-01-10',	NULL,	2,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(106,	'Integration Testing',	NULL,	17,	11,	8,	12,	'2024-12-03',	'2025-01-13',	NULL,	3,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(107,	'Deployment',	NULL,	18,	12,	9,	13,	'2024-12-06',	'2025-01-16',	NULL,	4,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(108,	'UAT',	NULL,	19,	1,	6,	10,	'2024-12-09',	'2025-01-19',	NULL,	5,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(109,	'Production Release',	NULL,	20,	2,	7,	11,	'2024-12-12',	'2025-01-22',	NULL,	6,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(110,	'Requirement Analysis',	NULL,	21,	3,	8,	12,	'2024-12-15',	'2025-01-25',	NULL,	7,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(111,	'Database Design',	NULL,	22,	4,	9,	13,	'2024-12-18',	'2025-01-28',	NULL,	8,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(112,	'API Development',	NULL,	23,	5,	6,	10,	'2024-12-21',	'2025-01-31',	NULL,	9,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(113,	'UI Design',	NULL,	24,	6,	7,	11,	'2024-12-24',	'2025-02-03',	NULL,	10,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(114,	'Authentication',	NULL,	25,	7,	8,	12,	'2024-12-27',	'2025-02-06',	NULL,	11,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(115,	'Dashboard',	NULL,	26,	8,	9,	13,	'2024-12-30',	'2025-02-09',	NULL,	12,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(116,	'Integration Testing',	NULL,	27,	9,	6,	10,	'2025-01-02',	'2025-02-12',	NULL,	13,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(117,	'Deployment',	NULL,	28,	10,	7,	11,	'2025-01-05',	'2025-02-15',	NULL,	14,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(118,	'UAT',	NULL,	29,	11,	8,	12,	'2025-01-08',	'2025-02-18',	NULL,	15,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(119,	'Production Release',	NULL,	30,	12,	9,	13,	'2025-01-11',	'2025-02-21',	NULL,	16,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(120,	'Requirement Analysis',	NULL,	1,	1,	6,	10,	'2025-01-14',	'2025-02-24',	NULL,	17,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(121,	'Database Design',	NULL,	2,	2,	7,	11,	'2025-01-17',	'2025-02-27',	NULL,	18,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(122,	'API Development',	NULL,	3,	3,	8,	12,	'2025-01-20',	'2025-03-02',	NULL,	19,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(123,	'UI Design',	NULL,	4,	4,	9,	13,	'2025-01-23',	'2025-03-05',	NULL,	20,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(124,	'Authentication',	NULL,	5,	5,	6,	10,	'2025-01-26',	'2025-03-08',	NULL,	21,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(125,	'Dashboard',	NULL,	6,	6,	7,	11,	'2025-01-29',	'2025-03-11',	NULL,	22,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(126,	'Integration Testing',	NULL,	7,	7,	8,	12,	'2025-02-01',	'2025-03-14',	NULL,	23,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(127,	'Deployment',	NULL,	8,	8,	9,	13,	'2025-02-04',	'2025-03-17',	NULL,	24,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(128,	'UAT',	NULL,	9,	9,	6,	10,	'2025-02-07',	'2025-03-20',	NULL,	25,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(129,	'Production Release',	NULL,	10,	10,	7,	11,	'2025-02-10',	'2025-03-23',	NULL,	26,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(130,	'Requirement Analysis',	NULL,	11,	11,	8,	12,	'2025-02-13',	'2025-03-26',	NULL,	27,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(131,	'Database Design',	NULL,	12,	12,	9,	13,	'2025-02-16',	'2025-03-29',	NULL,	28,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(132,	'API Development',	NULL,	13,	1,	6,	10,	'2025-02-19',	'2025-04-01',	NULL,	29,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(133,	'UI Design',	NULL,	14,	2,	7,	11,	'2025-02-22',	'2025-04-04',	NULL,	30,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(134,	'Authentication',	NULL,	15,	3,	8,	12,	'2025-02-25',	'2025-04-07',	NULL,	31,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(135,	'Dashboard',	NULL,	16,	4,	9,	13,	'2025-02-28',	'2025-04-10',	NULL,	32,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(136,	'Integration Testing',	NULL,	17,	5,	6,	10,	'2025-03-03',	'2025-04-13',	NULL,	33,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(137,	'Deployment',	NULL,	18,	6,	7,	11,	'2025-03-06',	'2025-04-16',	NULL,	34,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(138,	'UAT',	NULL,	19,	7,	8,	12,	'2025-03-09',	'2025-04-19',	NULL,	35,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(139,	'Production Release',	NULL,	20,	8,	9,	13,	'2025-03-12',	'2025-04-22',	NULL,	36,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(140,	'Requirement Analysis',	NULL,	21,	9,	6,	10,	'2025-03-15',	'2025-04-25',	NULL,	37,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(141,	'Database Design',	NULL,	22,	10,	7,	11,	'2025-03-18',	'2025-04-28',	NULL,	38,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(142,	'API Development',	NULL,	23,	11,	8,	12,	'2025-03-21',	'2025-05-01',	NULL,	39,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(143,	'UI Design',	NULL,	24,	12,	9,	13,	'2025-03-24',	'2025-05-04',	NULL,	40,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(144,	'Authentication',	NULL,	25,	1,	6,	10,	'2025-03-27',	'2025-05-07',	NULL,	41,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(145,	'Dashboard',	NULL,	26,	2,	7,	11,	'2025-03-30',	'2025-05-10',	NULL,	42,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(146,	'Integration Testing',	NULL,	27,	3,	8,	12,	'2025-04-02',	'2025-05-13',	NULL,	43,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(147,	'Deployment',	NULL,	28,	4,	9,	13,	'2025-04-05',	'2025-05-16',	NULL,	44,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(148,	'UAT',	NULL,	29,	5,	6,	10,	'2025-04-08',	'2025-05-19',	NULL,	45,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(149,	'Production Release',	NULL,	30,	6,	7,	11,	'2025-04-11',	'2025-05-22',	NULL,	46,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(150,	'Requirement Analysis',	NULL,	1,	7,	8,	12,	'2025-04-14',	'2025-05-25',	NULL,	47,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(151,	'Database Design',	NULL,	2,	8,	9,	13,	'2025-04-17',	'2025-05-28',	NULL,	48,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(152,	'API Development',	NULL,	3,	9,	6,	10,	'2025-04-20',	'2025-05-31',	NULL,	49,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(153,	'UI Design',	NULL,	4,	10,	7,	11,	'2025-04-23',	'2025-06-03',	NULL,	50,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(154,	'Authentication',	NULL,	5,	11,	8,	12,	'2025-04-26',	'2025-06-06',	NULL,	51,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(155,	'Dashboard',	NULL,	6,	12,	9,	13,	'2025-04-29',	'2025-06-09',	NULL,	52,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(156,	'Integration Testing',	NULL,	7,	1,	6,	10,	'2025-05-02',	'2025-06-12',	NULL,	1,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(157,	'Deployment',	NULL,	8,	2,	7,	11,	'2025-05-05',	'2025-06-15',	NULL,	2,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(158,	'UAT',	NULL,	9,	3,	8,	12,	'2025-05-08',	'2025-06-18',	NULL,	3,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(159,	'Production Release',	NULL,	10,	4,	9,	13,	'2025-05-11',	'2025-06-21',	NULL,	4,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(160,	'Requirement Analysis',	NULL,	11,	5,	6,	10,	'2025-05-14',	'2025-06-24',	NULL,	5,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(161,	'Database Design',	NULL,	12,	6,	7,	11,	'2025-05-17',	'2025-06-27',	NULL,	6,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(162,	'API Development',	NULL,	13,	7,	8,	12,	'2025-05-20',	'2025-06-30',	NULL,	7,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(163,	'UI Design',	NULL,	14,	8,	9,	13,	'2025-05-23',	'2025-07-03',	NULL,	8,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(164,	'Authentication',	NULL,	15,	9,	6,	10,	'2025-05-26',	'2025-07-06',	NULL,	9,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(165,	'Dashboard',	NULL,	16,	10,	7,	11,	'2025-05-29',	'2025-07-09',	NULL,	10,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(166,	'Integration Testing',	NULL,	17,	11,	8,	12,	'2025-06-01',	'2025-07-12',	NULL,	11,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(167,	'Deployment',	NULL,	18,	12,	9,	13,	'2025-06-04',	'2025-07-15',	NULL,	12,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(168,	'UAT',	NULL,	19,	1,	6,	10,	'2025-06-07',	'2025-07-18',	NULL,	13,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(169,	'Production Release',	NULL,	20,	2,	7,	11,	'2025-06-10',	'2025-07-21',	NULL,	14,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(170,	'Requirement Analysis',	NULL,	21,	3,	8,	12,	'2025-06-13',	'2025-07-24',	NULL,	15,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(171,	'Database Design',	NULL,	22,	4,	9,	13,	'2025-06-16',	'2025-07-27',	NULL,	16,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(172,	'API Development',	NULL,	23,	5,	6,	10,	'2025-06-19',	'2025-07-30',	NULL,	17,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(173,	'UI Design',	NULL,	24,	6,	7,	11,	'2025-06-22',	'2025-08-02',	NULL,	18,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(174,	'Authentication',	NULL,	25,	7,	8,	12,	'2025-06-25',	'2025-08-05',	NULL,	19,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(175,	'Dashboard',	NULL,	26,	8,	9,	13,	'2025-06-28',	'2025-08-08',	NULL,	20,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(176,	'Integration Testing',	NULL,	27,	9,	6,	10,	'2025-07-01',	'2025-08-11',	NULL,	21,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(177,	'Deployment',	NULL,	28,	10,	7,	11,	'2025-07-04',	'2025-08-14',	NULL,	22,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(178,	'UAT',	NULL,	29,	11,	8,	12,	'2025-07-07',	'2025-08-17',	NULL,	23,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(179,	'Production Release',	NULL,	30,	12,	9,	13,	'2025-07-10',	'2025-08-20',	NULL,	24,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(180,	'Requirement Analysis',	NULL,	1,	1,	6,	10,	'2025-07-13',	'2025-08-23',	NULL,	25,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(181,	'Database Design',	NULL,	2,	2,	7,	11,	'2025-07-16',	'2025-08-26',	NULL,	26,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(182,	'API Development',	NULL,	3,	3,	8,	12,	'2025-07-19',	'2025-08-29',	NULL,	27,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(183,	'UI Design',	NULL,	4,	4,	9,	13,	'2025-07-22',	'2025-09-01',	NULL,	28,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(184,	'Authentication',	NULL,	5,	5,	6,	10,	'2025-07-25',	'2025-09-04',	NULL,	29,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(185,	'Dashboard',	NULL,	6,	6,	7,	11,	'2025-07-28',	'2025-09-07',	NULL,	30,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(186,	'Integration Testing',	NULL,	7,	7,	8,	12,	'2025-07-31',	'2025-09-10',	NULL,	31,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(187,	'Deployment',	NULL,	8,	8,	9,	13,	'2025-08-03',	'2025-09-13',	NULL,	32,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(188,	'UAT',	NULL,	9,	9,	6,	10,	'2025-08-06',	'2025-09-16',	NULL,	33,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(189,	'Production Release',	NULL,	10,	10,	7,	11,	'2025-08-09',	'2025-09-19',	NULL,	34,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(190,	'Requirement Analysis',	NULL,	11,	11,	8,	12,	'2025-08-12',	'2025-09-22',	NULL,	35,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(191,	'Database Design',	NULL,	12,	12,	9,	13,	'2025-08-15',	'2025-09-25',	NULL,	36,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(192,	'API Development',	NULL,	13,	1,	6,	10,	'2025-08-18',	'2025-09-28',	NULL,	37,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(193,	'UI Design',	NULL,	14,	2,	7,	11,	'2025-08-21',	'2025-10-01',	NULL,	38,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(194,	'Authentication',	NULL,	15,	3,	8,	12,	'2025-08-24',	'2025-10-04',	NULL,	39,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(195,	'Dashboard',	NULL,	16,	4,	9,	13,	'2025-08-27',	'2025-10-07',	NULL,	40,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(196,	'Integration Testing',	NULL,	17,	5,	6,	10,	'2025-08-30',	'2025-10-10',	NULL,	41,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(197,	'Deployment',	NULL,	18,	6,	7,	11,	'2025-09-02',	'2025-10-13',	NULL,	42,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(198,	'UAT',	NULL,	19,	7,	8,	12,	'2025-09-05',	'2025-10-16',	NULL,	43,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(199,	'Production Release',	NULL,	20,	8,	9,	13,	'2025-09-08',	'2025-10-19',	NULL,	44,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899'),
(200,	'Requirement Analysis',	NULL,	21,	9,	6,	10,	'2025-09-11',	'2025-10-22',	NULL,	45,	NULL,	NULL,	NULL,	NULL,	'2026-07-13 08:46:39.532899',	'2026-07-13 08:46:39.532899');

ALTER TABLE ONLY "core"."projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES members(id);
ALTER TABLE ONLY "core"."projects" ADD CONSTRAINT "projects_project_type_id_fkey" FOREIGN KEY (project_type_id) REFERENCES dropdowns(id);
ALTER TABLE ONLY "core"."projects" ADD CONSTRAINT "projects_status_id_fkey" FOREIGN KEY (status_id) REFERENCES dropdowns(id);

ALTER TABLE ONLY "core"."task_stakeholders" ADD CONSTRAINT "task_stakeholders_stakeholder_id_fkey" FOREIGN KEY (stakeholder_id) REFERENCES dropdowns(id);
ALTER TABLE ONLY "core"."task_stakeholders" ADD CONSTRAINT "task_stakeholders_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY "core"."tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES members(id);
ALTER TABLE ONLY "core"."tasks" ADD CONSTRAINT "tasks_priority_id_fkey" FOREIGN KEY (priority_id) REFERENCES dropdowns(id);
ALTER TABLE ONLY "core"."tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY "core"."tasks" ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY (status_id) REFERENCES dropdowns(id);

-- Soft-delete support for DELETE-enabled business tables
CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON core.projects (archived_at);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON core.tasks (archived_at);

ALTER TABLE ONLY core.projects DROP CONSTRAINT IF EXISTS projects_archived_by_fkey;
ALTER TABLE ONLY core.projects ADD CONSTRAINT projects_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES core.members(id);

ALTER TABLE ONLY core.tasks DROP CONSTRAINT IF EXISTS tasks_archived_by_fkey;
ALTER TABLE ONLY core.tasks ADD CONSTRAINT tasks_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES core.members(id);

-- 2026-07-17 08:26:54 UTC


-- Synchronize sequences after explicit-ID seed data.
-- The third setval argument keeps an empty table's next generated ID at 1.
SELECT setval(
    'core.dropdowns_id_seq',
    COALESCE(MAX(id), 1),
    MAX(id) IS NOT NULL
) FROM core.dropdowns;

SELECT setval(
    'core.members_id_seq',
    COALESCE(MAX(id), 1),
    MAX(id) IS NOT NULL
) FROM core.members;

SELECT setval(
    'core.projects_id_seq',
    COALESCE(MAX(id), 1),
    MAX(id) IS NOT NULL
) FROM core.projects;

SELECT setval(
    'core.tasks_id_seq',
    COALESCE(MAX(id), 1),
    MAX(id) IS NOT NULL
) FROM core.tasks;


-- Data integrity hardening
ALTER TABLE core.projects ADD COLUMN IF NOT EXISTS currency_id bigint NOT NULL DEFAULT 46;

ALTER TABLE core.projects DROP CONSTRAINT IF EXISTS projects_currency_id_fkey;
ALTER TABLE core.projects ADD CONSTRAINT projects_currency_id_fkey
    FOREIGN KEY (currency_id) REFERENCES core.dropdowns(id);

ALTER TABLE core.projects DROP CONSTRAINT IF EXISTS projects_budget_plan_nonnegative;
ALTER TABLE core.projects ADD CONSTRAINT projects_budget_plan_nonnegative
    CHECK (budget_plan >= 0);

ALTER TABLE core.projects DROP CONSTRAINT IF EXISTS projects_actual_cost_nonnegative;
ALTER TABLE core.projects ADD CONSTRAINT projects_actual_cost_nonnegative
    CHECK (actual_cost >= 0);

ALTER TABLE core.dropdowns
    ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE core.members
    ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
    ALTER COLUMN updated_at TYPE timestamp with time zone
    USING updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE core.projects
    ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
    ALTER COLUMN updated_at TYPE timestamp with time zone
    USING updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
    ALTER COLUMN archived_at TYPE timestamp with time zone
    USING archived_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE core.tasks
    ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
    ALTER COLUMN updated_at TYPE timestamp with time zone
    USING updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
    ALTER COLUMN archived_at TYPE timestamp with time zone
    USING archived_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

SELECT setval('core.dropdowns_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM core.dropdowns;
SELECT setval('core.members_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM core.members;
SELECT setval('core.projects_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM core.projects;
SELECT setval('core.tasks_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM core.tasks;
