(260,	9,	'DELETE',	'tasks',	11,	NULL,	NULL,	NULL,	'2025-09-13 00:58:41.290032'),
(261,	10,	'INSERT',	'projects',	12,	NULL,	NULL,	NULL,	'2025-09-11 20:58:41.290032'),
(262,	11,	'UPDATE',	'opportunities',	13,	NULL,	NULL,	NULL,	'2025-09-10 16:58:41.290032'),
(263,	12,	'DELETE',	'closed_deals',	14,	NULL,	NULL,	NULL,	'2025-09-09 12:58:41.290032'),
(264,	1,	'INSERT',	'tasks',	15,	NULL,	NULL,	NULL,	'2025-09-08 08:58:41.290032'),
(265,	2,	'UPDATE',	'projects',	16,	NULL,	NULL,	NULL,	'2025-09-07 04:58:41.290032'),
(266,	3,	'DELETE',	'opportunities',	17,	NULL,	NULL,	NULL,	'2025-09-06 00:58:41.290032'),
(267,	4,	'INSERT',	'closed_deals',	18,	NULL,	NULL,	NULL,	'2025-09-04 20:58:41.290032'),
(268,	5,	'UPDATE',	'tasks',	19,	NULL,	NULL,	NULL,	'2025-09-03 16:58:41.290032'),
(269,	6,	'DELETE',	'projects',	20,	NULL,	NULL,	NULL,	'2025-09-02 12:58:41.290032'),
(270,	7,	'INSERT',	'opportunities',	21,	NULL,	NULL,	NULL,	'2025-09-01 08:58:41.290032'),
(271,	8,	'UPDATE',	'closed_deals',	22,	NULL,	NULL,	NULL,	'2025-08-31 04:58:41.290032'),
(272,	9,	'DELETE',	'tasks',	23,	NULL,	NULL,	NULL,	'2025-08-30 00:58:41.290032'),
(273,	10,	'INSERT',	'projects',	24,	NULL,	NULL,	NULL,	'2025-08-28 20:58:41.290032'),
(274,	11,	'UPDATE',	'opportunities',	25,	NULL,	NULL,	NULL,	'2025-08-27 16:58:41.290032'),
(275,	12,	'DELETE',	'closed_deals',	26,	NULL,	NULL,	NULL,	'2025-08-26 12:58:41.290032'),
(276,	1,	'INSERT',	'tasks',	27,	NULL,	NULL,	NULL,	'2025-08-25 08:58:41.290032'),
(277,	2,	'UPDATE',	'projects',	28,	NULL,	NULL,	NULL,	'2025-08-24 04:58:41.290032'),
(278,	3,	'DELETE',	'opportunities',	29,	NULL,	NULL,	NULL,	'2025-08-23 00:58:41.290032'),
(279,	4,	'INSERT',	'closed_deals',	30,	NULL,	NULL,	NULL,	'2025-08-21 20:58:41.290032'),
(280,	5,	'UPDATE',	'tasks',	31,	NULL,	NULL,	NULL,	'2025-08-20 16:58:41.290032'),
(281,	6,	'DELETE',	'projects',	32,	NULL,	NULL,	NULL,	'2025-08-19 12:58:41.290032'),
(282,	7,	'INSERT',	'opportunities',	33,	NULL,	NULL,	NULL,	'2025-08-18 08:58:41.290032'),
(283,	8,	'UPDATE',	'closed_deals',	34,	NULL,	NULL,	NULL,	'2025-08-17 04:58:41.290032'),
(284,	9,	'DELETE',	'tasks',	35,	NULL,	NULL,	NULL,	'2025-08-16 00:58:41.290032'),
(285,	10,	'INSERT',	'projects',	36,	NULL,	NULL,	NULL,	'2025-08-14 20:58:41.290032'),
(286,	11,	'UPDATE',	'opportunities',	37,	NULL,	NULL,	NULL,	'2025-08-13 16:58:41.290032'),
(287,	12,	'DELETE',	'closed_deals',	38,	NULL,	NULL,	NULL,	'2025-08-12 12:58:41.290032'),
(288,	1,	'INSERT',	'tasks',	39,	NULL,	NULL,	NULL,	'2025-08-11 08:58:41.290032'),
(289,	2,	'UPDATE',	'projects',	40,	NULL,	NULL,	NULL,	'2025-08-10 04:58:41.290032'),
(290,	3,	'DELETE',	'opportunities',	41,	NULL,	NULL,	NULL,	'2025-08-09 00:58:41.290032'),
(291,	4,	'INSERT',	'closed_deals',	42,	NULL,	NULL,	NULL,	'2025-08-07 20:58:41.290032'),
(292,	5,	'UPDATE',	'tasks',	43,	NULL,	NULL,	NULL,	'2025-08-06 16:58:41.290032'),
(293,	6,	'DELETE',	'projects',	44,	NULL,	NULL,	NULL,	'2025-08-05 12:58:41.290032'),
(294,	7,	'INSERT',	'opportunities',	45,	NULL,	NULL,	NULL,	'2025-08-04 08:58:41.290032'),
(295,	8,	'UPDATE',	'closed_deals',	46,	NULL,	NULL,	NULL,	'2025-08-03 04:58:41.290032'),
(296,	9,	'DELETE',	'tasks',	47,	NULL,	NULL,	NULL,	'2025-08-02 00:58:41.290032'),
(297,	10,	'INSERT',	'projects',	48,	NULL,	NULL,	NULL,	'2025-07-31 20:58:41.290032'),
(298,	11,	'UPDATE',	'opportunities',	49,	NULL,	NULL,	NULL,	'2025-07-30 16:58:41.290032'),
(299,	12,	'DELETE',	'closed_deals',	50,	NULL,	NULL,	NULL,	'2025-07-29 12:58:41.290032'),
(300,	1,	'INSERT',	'tasks',	1,	NULL,	NULL,	NULL,	'2025-07-28 08:58:41.290032');

DROP TABLE IF EXISTS "backups";
DROP SEQUENCE IF EXISTS "sys_admin".backups_id_seq;
CREATE SEQUENCE "sys_admin".backups_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "sys_admin"."backups" (
    "id" bigint DEFAULT nextval('backups_id_seq') NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "backup_type" character varying(30),
    "file_size" bigint,
    "created_by" bigint,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

TRUNCATE "backups";
INSERT INTO "backups" ("id", "file_name", "backup_type", "file_size", "created_by", "created_at") VALUES
(1,	'backup_crm_db_1.sql',	'INCREMENTAL',	106954752,	2,	'2026-07-12 21:01:55.50024'),
(2,	'backup_crm_db_2.sql',	'INCREMENTAL',	109051904,	3,	'2026-07-12 09:01:55.50024'),
(3,	'backup_crm_db_3.sql',	'INCREMENTAL',	111149056,	4,	'2026-07-11 21:01:55.50024'),
(4,	'backup_crm_db_4.sql',	'INCREMENTAL',	113246208,	5,	'2026-07-11 09:01:55.50024'),
(5,	'backup_crm_db_5.sql',	'FULL',	115343360,	6,	'2026-07-10 21:01:55.50024'),
(6,	'backup_crm_db_6.sql',	'INCREMENTAL',	117440512,	7,	'2026-07-10 09:01:55.50024'),
(7,	'backup_crm_db_7.sql',	'INCREMENTAL',	119537664,	8,	'2026-07-09 21:01:55.50024'),
(8,	'backup_crm_db_8.sql',	'INCREMENTAL',	121634816,	9,	'2026-07-09 09:01:55.50024'),
(9,	'backup_crm_db_9.sql',	'INCREMENTAL',	123731968,	10,	'2026-07-08 21:01:55.50024'),
(10,	'backup_crm_db_10.sql',	'FULL',	125829120,	11,	'2026-07-08 09:01:55.50024'),
(11,	'backup_crm_db_11.sql',	'INCREMENTAL',	127926272,	12,	'2026-07-07 21:01:55.50024'),
(12,	'backup_crm_db_12.sql',	'INCREMENTAL',	130023424,	1,	'2026-07-07 09:01:55.50024'),
(13,	'backup_crm_db_13.sql',	'INCREMENTAL',	132120576,	2,	'2026-07-06 21:01:55.50024'),
(14,	'backup_crm_db_14.sql',	'INCREMENTAL',	134217728,	3,	'2026-07-06 09:01:55.50024'),
(15,	'backup_crm_db_15.sql',	'FULL',	136314880,	4,	'2026-07-05 21:01:55.50024'),
(16,	'backup_crm_db_16.sql',	'INCREMENTAL',	138412032,	5,	'2026-07-05 09:01:55.50024'),
(17,	'backup_crm_db_17.sql',	'INCREMENTAL',	140509184,	6,	'2026-07-04 21:01:55.50024'),
(18,	'backup_crm_db_18.sql',	'INCREMENTAL',	142606336,	7,	'2026-07-04 09:01:55.50024'),
(19,	'backup_crm_db_19.sql',	'INCREMENTAL',	144703488,	8,	'2026-07-03 21:01:55.50024'),
(20,	'backup_crm_db_20.sql',	'FULL',	146800640,	9,	'2026-07-03 09:01:55.50024'),
(21,	'backup_crm_db_21.sql',	'INCREMENTAL',	148897792,	10,	'2026-07-02 21:01:55.50024'),
(22,	'backup_crm_db_22.sql',	'INCREMENTAL',	150994944,	11,	'2026-07-02 09:01:55.50024'),
(23,	'backup_crm_db_23.sql',	'INCREMENTAL',	153092096,	12,	'2026-07-01 21:01:55.50024'),
(24,	'backup_crm_db_24.sql',	'INCREMENTAL',	155189248,	1,	'2026-07-01 09:01:55.50024'),
(25,	'backup_crm_db_25.sql',	'FULL',	157286400,	2,	'2026-06-30 21:01:55.50024'),
(26,	'backup_crm_db_26.sql',	'INCREMENTAL',	159383552,	3,	'2026-06-30 09:01:55.50024'),
(27,	'backup_crm_db_27.sql',	'INCREMENTAL',	161480704,	4,	'2026-06-29 21:01:55.50024'),
(28,	'backup_crm_db_28.sql',	'INCREMENTAL',	163577856,	5,	'2026-06-29 09:01:55.50024'),
(29,	'backup_crm_db_29.sql',	'INCREMENTAL',	165675008,	6,	'2026-06-28 21:01:55.50024'),
(30,	'backup_crm_db_30.sql',	'FULL',	167772160,	7,	'2026-06-28 09:01:55.50024');

DROP TABLE IF EXISTS "export_logs";
DROP SEQUENCE IF EXISTS "sys_admin".export_logs_id_seq;
CREATE SEQUENCE "sys_admin".export_logs_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "sys_admin"."export_logs" (
    "id" bigint DEFAULT nextval('export_logs_id_seq') NOT NULL,
    "export_type" character varying(50),
    "period" character varying(50),
    "file_name" character varying(255),
    "exported_by" bigint,
    "exported_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_logs_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

TRUNCATE "export_logs";
INSERT INTO "export_logs" ("id", "export_type", "period", "file_name", "exported_by", "exported_at") VALUES
(1,	'projects',	'2026-M02',	'export_projects_1.xlsx',	2,	'2026-07-12 15:03:38.220072'),
(2,	'project_expenses',	'2026-M03',	'export_expenses_2.csv',	3,	'2026-07-11 21:03:38.220072'),
(3,	'closed_deals',	'2026-M04',	'export_closed_deals_3.csv',	4,	'2026-07-11 03:03:38.220072'),
(4,	'projects',	'2026-M05',	'export_projects_4.xlsx',	5,	'2026-07-10 09:03:38.220072'),
(5,	'project_expenses',	'2026-M06',	'export_expenses_5.csv',	6,	'2026-07-09 15:03:38.220072'),
(6,	'closed_deals',	'2026-M07',	'export_closed_deals_6.csv',	7,	'2026-07-08 21:03:38.220072'),
(7,	'projects',	'2026-M08',	'export_projects_7.xlsx',	8,	'2026-07-08 03:03:38.220072'),
(8,	'project_expenses',	'2026-M09',	'export_expenses_8.csv',	9,	'2026-07-07 09:03:38.220072'),
(9,	'closed_deals',	'2026-M10',	'export_closed_deals_9.csv',	10,	'2026-07-06 15:03:38.220072'),
(10,	'projects',	'2026-M11',	'export_projects_10.xlsx',	11,	'2026-07-05 21:03:38.220072'),
(11,	'project_expenses',	'2026-M12',	'export_expenses_11.csv',	12,	'2026-07-05 03:03:38.220072'),
(12,	'closed_deals',	'2026-M01',	'export_closed_deals_12.csv',	1,	'2026-07-04 09:03:38.220072'),
(13,	'projects',	'2026-M02',	'export_projects_13.xlsx',	2,	'2026-07-03 15:03:38.220072'),
(14,	'project_expenses',	'2026-M03',	'export_expenses_14.csv',	3,	'2026-07-02 21:03:38.220072'),
(15,	'closed_deals',	'2026-M04',	'export_closed_deals_15.csv',	4,	'2026-07-02 03:03:38.220072'),
(16,	'projects',	'2026-M05',	'export_projects_16.xlsx',	5,	'2026-07-01 09:03:38.220072'),
(17,	'project_expenses',	'2026-M06',	'export_expenses_17.csv',	6,	'2026-06-30 15:03:38.220072'),
(18,	'closed_deals',	'2026-M07',	'export_closed_deals_18.csv',	7,	'2026-06-29 21:03:38.220072'),
(19,	'projects',	'2026-M08',	'export_projects_19.xlsx',	8,	'2026-06-29 03:03:38.220072'),
(20,	'project_expenses',	'2026-M09',	'export_expenses_20.csv',	9,	'2026-06-28 09:03:38.220072'),
(21,	'closed_deals',	'2026-M10',	'export_closed_deals_21.csv',	10,	'2026-06-27 15:03:38.220072'),
(22,	'projects',	'2026-M11',	'export_projects_22.xlsx',	11,	'2026-06-26 21:03:38.220072'),
(23,	'project_expenses',	'2026-M12',	'export_expenses_23.csv',	12,	'2026-06-26 03:03:38.220072'),
(24,	'closed_deals',	'2026-M01',	'export_closed_deals_24.csv',	1,	'2026-06-25 09:03:38.220072'),
(25,	'projects',	'2026-M02',	'export_projects_25.xlsx',	2,	'2026-06-24 15:03:38.220072'),
(26,	'project_expenses',	'2026-M03',	'export_expenses_26.csv',	3,	'2026-06-23 21:03:38.220072'),
(27,	'closed_deals',	'2026-M04',	'export_closed_deals_27.csv',	4,	'2026-06-23 03:03:38.220072'),
(28,	'projects',	'2026-M05',	'export_projects_28.xlsx',	5,	'2026-06-22 09:03:38.220072'),
(29,	'project_expenses',	'2026-M06',	'export_expenses_29.csv',	6,	'2026-06-21 15:03:38.220072'),
(30,	'closed_deals',	'2026-M07',	'export_closed_deals_30.csv',	7,	'2026-06-20 21:03:38.220072');

DROP TABLE IF EXISTS "import_logs";
DROP SEQUENCE IF EXISTS "sys_admin".import_logs_id_seq;
CREATE SEQUENCE "sys_admin".import_logs_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "sys_admin"."import_logs" (
    "id" bigint DEFAULT nextval('import_logs_id_seq') NOT NULL,
    "import_type" character varying(50),
    "file_name" character varying(255),
    "total_rows" integer,
    "success_rows" integer,
    "failed_rows" integer,
    "imported_by" bigint,
    "imported_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

TRUNCATE "import_logs";
INSERT INTO "import_logs" ("id", "import_type", "file_name", "total_rows", "success_rows", "failed_rows", "imported_by", "imported_at") VALUES
(1,	'opportunities',	'import_opportunities_1.xlsx',	12,	11,	1,	2,	'2026-07-12 18:02:45.433881'),
(2,	'tasks',	'import_tasks_2.xlsx',	14,	12,	2,	3,	'2026-07-12 03:02:45.433881'),
(3,	'members',	'import_members_3.xlsx',	13,	13,	0,	4,	'2026-07-11 12:02:45.433881'),
(4,	'opportunities',	'import_opportunities_4.xlsx',	15,	14,	1,	5,	'2026-07-10 21:02:45.433881'),
(5,	'tasks',	'import_tasks_5.xlsx',	17,	15,	2,	6,	'2026-07-10 06:02:45.433881'),
(6,	'members',	'import_members_6.xlsx',	16,	16,	0,	7,	'2026-07-09 15:02:45.433881'),
(7,	'opportunities',	'import_opportunities_7.xlsx',	18,	17,	1,	8,	'2026-07-09 00:02:45.433881'),
(8,	'tasks',	'import_tasks_8.xlsx',	20,	18,	2,	9,	'2026-07-08 09:02:45.433881'),
(9,	'members',	'import_members_9.xlsx',	19,	19,	0,	10,	'2026-07-07 18:02:45.433881'),
(10,	'opportunities',	'import_opportunities_10.xlsx',	21,	20,	1,	11,	'2026-07-07 03:02:45.433881'),
(11,	'tasks',	'import_tasks_11.xlsx',	23,	21,	2,	12,	'2026-07-06 12:02:45.433881'),
(12,	'members',	'import_members_12.xlsx',	22,	22,	0,	1,	'2026-07-05 21:02:45.433881'),
(13,	'opportunities',	'import_opportunities_13.xlsx',	24,	23,	1,	2,	'2026-07-05 06:02:45.433881'),
(14,	'tasks',	'import_tasks_14.xlsx',	26,	24,	2,	3,	'2026-07-04 15:02:45.433881'),
(15,	'members',	'import_members_15.xlsx',	25,	25,	0,	4,	'2026-07-04 00:02:45.433881'),
(16,	'opportunities',	'import_opportunities_16.xlsx',	27,	26,	1,	5,	'2026-07-03 09:02:45.433881'),
(17,	'tasks',	'import_tasks_17.xlsx',	29,	27,	2,	6,	'2026-07-02 18:02:45.433881'),
(18,	'members',	'import_members_18.xlsx',	28,	28,	0,	7,	'2026-07-02 03:02:45.433881'),
(19,	'opportunities',	'import_opportunities_19.xlsx',	30,	29,	1,	8,	'2026-07-01 12:02:45.433881'),
(20,	'tasks',	'import_tasks_20.xlsx',	32,	30,	2,	9,	'2026-06-30 21:02:45.433881'),
(21,	'members',	'import_members_21.xlsx',	31,	31,	0,	10,	'2026-06-30 06:02:45.433881'),
(22,	'opportunities',	'import_opportunities_22.xlsx',	33,	32,	1,	11,	'2026-06-29 15:02:45.433881'),
(23,	'tasks',	'import_tasks_23.xlsx',	35,	33,	2,	12,	'2026-06-29 00:02:45.433881'),
(24,	'members',	'import_members_24.xlsx',	34,	34,	0,	1,	'2026-06-28 09:02:45.433881'),
(25,	'opportunities',	'import_opportunities_25.xlsx',	36,	35,	1,	2,	'2026-06-27 18:02:45.433881'),
(26,	'tasks',	'import_tasks_26.xlsx',	38,	36,	2,	3,	'2026-06-27 03:02:45.433881'),
(27,	'members',	'import_members_27.xlsx',	37,	37,	0,	4,	'2026-06-26 12:02:45.433881'),
(28,	'opportunities',	'import_opportunities_28.xlsx',	39,	38,	1,	5,	'2026-06-25 21:02:45.433881'),
(29,	'tasks',	'import_tasks_29.xlsx',	41,	39,	2,	6,	'2026-06-25 06:02:45.433881'),
(30,	'members',	'import_members_30.xlsx',	40,	40,	0,	7,	'2026-06-24 15:02:45.433881');

DROP TABLE IF EXISTS "slack_notification_logs";
DROP SEQUENCE IF EXISTS "sys_admin".slack_notification_logs_id_seq;
CREATE SEQUENCE "sys_admin".slack_notification_logs_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "sys_admin"."slack_notification_logs" (
    "id" bigint DEFAULT nextval('slack_notification_logs_id_seq') NOT NULL,
    "sent_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "overdue_tasks" integer DEFAULT '0',
    "upcoming_tasks" integer DEFAULT '0',
    "status" character varying(30),
    "message" text,
    CONSTRAINT "slack_notification_logs_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

TRUNCATE "slack_notification_logs";
INSERT INTO "slack_notification_logs" ("id", "sent_at", "overdue_tasks", "upcoming_tasks", "status", "message") VALUES
(1,	'2026-07-13 01:00:53.714045',	1,	3,	'SUCCESS',	'Notification payload broadcast report item #1'),
(2,	'2026-07-12 17:00:53.714045',	2,	4,	'SUCCESS',	'Notification payload broadcast report item #2'),
(3,	'2026-07-12 09:00:53.714045',	3,	5,	'SUCCESS',	'Notification payload broadcast report item #3'),
(4,	'2026-07-12 01:00:53.714045',	4,	6,	'SUCCESS',	'Notification payload broadcast report item #4'),
(5,	'2026-07-11 17:00:53.714045',	0,	7,	'SUCCESS',	'Notification payload broadcast report item #5'),
(6,	'2026-07-11 09:00:53.714045',	1,	8,	'SUCCESS',	'Notification payload broadcast report item #6'),
(7,	'2026-07-11 01:00:53.714045',	2,	9,	'SUCCESS',	'Notification payload broadcast report item #7'),
(8,	'2026-07-10 17:00:53.714045',	3,	2,	'SUCCESS',	'Notification payload broadcast report item #8'),
(9,	'2026-07-10 09:00:53.714045',	4,	3,	'SUCCESS',	'Notification payload broadcast report item #9'),
(10,	'2026-07-10 01:00:53.714045',	0,	4,	'SUCCESS',	'Notification payload broadcast report item #10'),
(11,	'2026-07-09 17:00:53.714045',	1,	5,	'SUCCESS',	'Notification payload broadcast report item #11'),
(12,	'2026-07-09 09:00:53.714045',	2,	6,	'SUCCESS',	'Notification payload broadcast report item #12'),
(13,	'2026-07-09 01:00:53.714045',	3,	7,	'SUCCESS',	'Notification payload broadcast report item #13'),
(14,	'2026-07-08 17:00:53.714045',	4,	8,	'SUCCESS',	'Notification payload broadcast report item #14'),
(15,	'2026-07-08 09:00:53.714045',	0,	9,	'FAILED',	'Notification payload broadcast report item #15'),
(16,	'2026-07-08 01:00:53.714045',	1,	2,	'SUCCESS',	'Notification payload broadcast report item #16'),
(17,	'2026-07-07 17:00:53.714045',	2,	3,	'SUCCESS',	'Notification payload broadcast report item #17'),
(18,	'2026-07-07 09:00:53.714045',	3,	4,	'SUCCESS',	'Notification payload broadcast report item #18'),
(19,	'2026-07-07 01:00:53.714045',	4,	5,	'SUCCESS',	'Notification payload broadcast report item #19'),
(20,	'2026-07-06 17:00:53.714045',	0,	6,	'SUCCESS',	'Notification payload broadcast report item #20'),
(21,	'2026-07-06 09:00:53.714045',	1,	7,	'SUCCESS',	'Notification payload broadcast report item #21'),
(22,	'2026-07-06 01:00:53.714045',	2,	8,	'SUCCESS',	'Notification payload broadcast report item #22'),
(23,	'2026-07-05 17:00:53.714045',	3,	9,	'SUCCESS',	'Notification payload broadcast report item #23'),
(24,	'2026-07-05 09:00:53.714045',	4,	2,	'SUCCESS',	'Notification payload broadcast report item #24'),
(25,	'2026-07-05 01:00:53.714045',	0,	3,	'SUCCESS',	'Notification payload broadcast report item #25'),
(26,	'2026-07-04 17:00:53.714045',	1,	4,	'SUCCESS',	'Notification payload broadcast report item #26'),
(27,	'2026-07-04 09:00:53.714045',	2,	5,	'SUCCESS',	'Notification payload broadcast report item #27'),
(28,	'2026-07-04 01:00:53.714045',	3,	6,	'SUCCESS',	'Notification payload broadcast report item #28'),
(29,	'2026-07-03 17:00:53.714045',	4,	7,	'SUCCESS',	'Notification payload broadcast report item #29'),
(30,	'2026-07-03 09:00:53.714045',	0,	8,	'FAILED',	'Notification payload broadcast report item #30');

DROP TABLE IF EXISTS "slack_settings";
DROP SEQUENCE IF EXISTS "sys_admin".slack_settings_id_seq;
CREATE SEQUENCE "sys_admin".slack_settings_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE "sys_admin"."slack_settings" (
    "id" bigint DEFAULT nextval('slack_settings_id_seq') NOT NULL,
    "webhook_url" text NOT NULL,
    "channel" character varying(100),
    "enable_notification" boolean DEFAULT true,
    "notify_time" time without time zone DEFAULT '08:00:00',
    "notify_mon" boolean DEFAULT true,
    "notify_tue" boolean DEFAULT true,
    "notify_wed" boolean DEFAULT true,
    "notify_thu" boolean DEFAULT true,
    "notify_fri" boolean DEFAULT true,
    "notify_sat" boolean DEFAULT false,
    "notify_sun" boolean DEFAULT false,
    "warning_days" integer DEFAULT '5',
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "slack_settings_pkey" PRIMARY KEY ("id")
)
WITH (oids = false);

TRUNCATE "slack_settings";
INSERT INTO "slack_settings" ("id", "webhook_url", "channel", "enable_notification", "notify_time", "notify_mon", "notify_tue", "notify_wed", "notify_thu", "notify_fri", "notify_sat", "notify_sun", "warning_days", "created_at", "updated_at") VALUES
(1,	'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',	'#crm-alerts',	'1',	'08:00:00',	'1',	'1',	'1',	'1',	'1',	'0',	'0',	5,	'2026-07-13 08:59:41.361568',	'2026-07-13 08:59:41.361568');

ALTER TABLE ONLY "sys_admin"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES core.members(id);

ALTER TABLE ONLY "sys_admin"."backups" ADD CONSTRAINT "backups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES core.members(id);

ALTER TABLE ONLY "sys_admin"."export_logs" ADD CONSTRAINT "export_logs_exported_by_fkey" FOREIGN KEY (exported_by) REFERENCES core.members(id);

ALTER TABLE ONLY "sys_admin"."import_logs" ADD CONSTRAINT "import_logs_imported_by_fkey" FOREIGN KEY (imported_by) REFERENCES core.members(id);

-- 2026-07-17 08:30:17 UTC


-- Do not persist a fake Slack configuration when no real configuration exists.
TRUNCATE TABLE sys_admin.slack_settings;

-- UPDATE audit rows must contain a minimal before/after change payload.
UPDATE sys_admin.audit_logs
SET field_changed = 'status_id',
    old_value = jsonb_build_object('value', 'before'),
    new_value = jsonb_build_object('value', 'after')
WHERE action = 'UPDATE'
  AND field_changed IS NULL;

ALTER TABLE sys_admin.audit_logs
    ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE sys_admin.backups
    ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE sys_admin.export_logs
    ALTER COLUMN exported_at TYPE timestamp with time zone
    USING exported_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE sys_admin.import_logs
    ALTER COLUMN imported_at TYPE timestamp with time zone
    USING imported_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE sys_admin.slack_notification_logs
    ALTER COLUMN sent_at TYPE timestamp with time zone
    USING sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

ALTER TABLE sys_admin.slack_settings
    ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
    ALTER COLUMN updated_at TYPE timestamp with time zone
    USING updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

SELECT setval('sys_admin.audit_logs_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM sys_admin.audit_logs;
SELECT setval('sys_admin.backups_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM sys_admin.backups;
SELECT setval('sys_admin.export_logs_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM sys_admin.export_logs;
SELECT setval('sys_admin.import_logs_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM sys_admin.import_logs;
SELECT setval('sys_admin.slack_notification_logs_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM sys_admin.slack_notification_logs;
SELECT setval('sys_admin.slack_settings_id_seq', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM sys_admin.slack_settings;
