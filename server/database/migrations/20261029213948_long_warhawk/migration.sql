ALTER TABLE `quality_issues` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `quality_issues` ADD `deleted_by_user_id` text;--> statement-breakpoint
ALTER TABLE `quality_issues` ADD `deletion_reason` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_logs` (
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
	CONSTRAINT "audit_logs_action_check" CHECK("action" in ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATUS_CHANGE', 'ROLLBACK', 'UPLOAD'))
);
--> statement-breakpoint
INSERT INTO `__new_audit_logs`(`id`, `entity_type`, `entity_id`, `action`, `from_status`, `to_status`, `metadata_json`, `actor_user_id`, `created_at`) SELECT `id`, `entity_type`, `entity_id`, `action`, `from_status`, `to_status`, `metadata_json`, `actor_user_id`, `created_at` FROM `audit_logs`;--> statement-breakpoint
DROP TABLE `audit_logs`;--> statement-breakpoint
ALTER TABLE `__new_audit_logs` RENAME TO `audit_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_logs_entity_type_entity_id_created_at_idx` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_idx` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TRIGGER `audit_logs_append_only_update`
BEFORE UPDATE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_logs_append_only_delete`
BEFORE DELETE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
--> statement-breakpoint
CREATE INDEX `quality_issues_deleted_at_idx` ON `quality_issues` (`deleted_at`);
