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
CREATE INDEX `audit_logs_entity_type_entity_id_created_at_idx` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_idx` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);
--> statement-breakpoint
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
