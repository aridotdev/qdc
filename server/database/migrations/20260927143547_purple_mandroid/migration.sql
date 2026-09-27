CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`detail_id` integer,
	`sample_id` integer,
	`report_id` integer,
	`file_name` text NOT NULL,
	`storage_name` text NOT NULL UNIQUE,
	`file_url` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	CONSTRAINT `fk_attachments_detail_id_quality_issue_details_id_fk` FOREIGN KEY (`detail_id`) REFERENCES `quality_issue_details`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_attachments_sample_id_sample_defects_id_fk` FOREIGN KEY (`sample_id`) REFERENCES `sample_defects`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_attachments_report_id_technical_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `technical_reports`(`id`) ON DELETE CASCADE,
	CONSTRAINT "attachments_file_type_check" CHECK("file_type" in ('image/jpeg', 'image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'video/mp4')),
	CONSTRAINT "attachments_file_size_check" CHECK("file_size" >= 0),
	CONSTRAINT "attachments_single_owner_check" CHECK((
        (case when "detail_id" is not null then 1 else 0 end) +
        (case when "sample_id" is not null then 1 else 0 end) +
        (case when "report_id" is not null then 1 else 0 end)
      ) = 1)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`metadata_json` text,
	`actor_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "audit_logs_entity_type_check" CHECK("entity_type" in ('QUALITY_ISSUE', 'QUALITY_ISSUE_DETAIL', 'SAMPLE_DEFECT', 'TECHNICAL_REPORT', 'ATTACHMENT')),
	CONSTRAINT "audit_logs_entity_id_check" CHECK("entity_id" > 0),
	CONSTRAINT "audit_logs_action_check" CHECK("action" in ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ROLLBACK', 'UPLOAD'))
);
--> statement-breakpoint
CREATE TABLE `quality_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`issue_name` text NOT NULL,
	`model_name` text NOT NULL,
	`serial_number` text NOT NULL,
	`tanggal_kejadian` text NOT NULL,
	`notification_number` text,
	`detail` text NOT NULL,
	`keterangan` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	CONSTRAINT "quality_issues_status_check" CHECK("status" in ('OPEN', 'IN_PROGRESS', 'MONITORING', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE `quality_issue_details` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`issue_id` integer NOT NULL,
	`tanggal` text NOT NULL,
	`action` text NOT NULL,
	`remark` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	CONSTRAINT `fk_quality_issue_details_issue_id_quality_issues_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `quality_issues`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sample_defects` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`batch_id` text NOT NULL,
	`issue_id` integer,
	`notification_number` text NOT NULL,
	`model_name` text NOT NULL,
	`serial_number` text NOT NULL,
	`cabang` text NOT NULL,
	`part_number` text NOT NULL,
	`part_name` text NOT NULL,
	`kerusakan_cabang` text NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`tanggal_terima` text,
	`keterangan_terima` text,
	`nama_penerima_pqa` text,
	`tanggal_serah_pqa` text,
	`kerusakan_verifikasi` text,
	`kondisi_pqa` text,
	`repair` text,
	`hasil_analisa_supplier` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	CONSTRAINT `fk_sample_defects_issue_id_quality_issues_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `quality_issues`(`id`) ON DELETE SET NULL,
	CONSTRAINT "sample_defects_status_check" CHECK("status" in ('REQUESTED', 'RECEIVED', 'QRCC_VERIFIED', 'HANDED_OVER_TO_PQA', 'PQA_ANALYZED', 'SUPPLIER_ANALYZED')),
	CONSTRAINT "sample_defects_kondisi_pqa_check" CHECK("kondisi_pqa" in ('NG', 'NDF'))
);
--> statement-breakpoint
CREATE TABLE `technical_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`issue_id` integer,
	`document_number` text NOT NULL UNIQUE,
	`document_type` text NOT NULL,
	`release_date` text NOT NULL,
	`model_name` text NOT NULL,
	`issue_name` text NOT NULL,
	`root_cause` text,
	`action` text,
	`improvement_start_date` text,
	`improvement_start_serial_number` text,
	`document_reference` text,
	`keterangan` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	CONSTRAINT `fk_technical_reports_issue_id_quality_issues_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `quality_issues`(`id`) ON DELETE SET NULL,
	CONSTRAINT "technical_reports_document_type_check" CHECK("document_type" in ('TECHNICAL_REPORT', 'SERVICE_TIPS'))
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachments_detail_id_idx` ON `attachments` (`detail_id`);--> statement-breakpoint
CREATE INDEX `attachments_sample_id_idx` ON `attachments` (`sample_id`);--> statement-breakpoint
CREATE INDEX `attachments_report_id_idx` ON `attachments` (`report_id`);--> statement-breakpoint
CREATE INDEX `attachments_file_type_idx` ON `attachments` (`file_type`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_type_entity_id_created_at_idx` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_idx` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `quality_issues_status_idx` ON `quality_issues` (`status`);--> statement-breakpoint
CREATE INDEX `quality_issues_notification_number_idx` ON `quality_issues` (`notification_number`);--> statement-breakpoint
CREATE INDEX `quality_issues_model_name_idx` ON `quality_issues` (`model_name`);--> statement-breakpoint
CREATE INDEX `quality_issues_tanggal_kejadian_idx` ON `quality_issues` (`tanggal_kejadian`);--> statement-breakpoint
CREATE INDEX `quality_issue_details_issue_id_tanggal_idx` ON `quality_issue_details` (`issue_id`,`tanggal`);--> statement-breakpoint
CREATE INDEX `quality_issue_details_tanggal_idx` ON `quality_issue_details` (`tanggal`);--> statement-breakpoint
CREATE INDEX `sample_defects_batch_id_idx` ON `sample_defects` (`batch_id`);--> statement-breakpoint
CREATE INDEX `sample_defects_issue_id_idx` ON `sample_defects` (`issue_id`);--> statement-breakpoint
CREATE INDEX `sample_defects_notification_number_idx` ON `sample_defects` (`notification_number`);--> statement-breakpoint
CREATE INDEX `sample_defects_status_idx` ON `sample_defects` (`status`);--> statement-breakpoint
CREATE INDEX `sample_defects_model_name_part_number_idx` ON `sample_defects` (`model_name`,`part_number`);--> statement-breakpoint
CREATE INDEX `technical_reports_issue_id_idx` ON `technical_reports` (`issue_id`);--> statement-breakpoint
CREATE INDEX `technical_reports_document_type_idx` ON `technical_reports` (`document_type`);--> statement-breakpoint
CREATE INDEX `technical_reports_release_date_idx` ON `technical_reports` (`release_date`);--> statement-breakpoint
CREATE INDEX `technical_reports_model_name_idx` ON `technical_reports` (`model_name`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TRIGGER `audit_logs_prevent_update`
BEFORE UPDATE ON `audit_logs`
BEGIN
	SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_logs_prevent_delete`
BEFORE DELETE ON `audit_logs`
BEGIN
	SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
