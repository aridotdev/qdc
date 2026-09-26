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
CREATE INDEX `technical_reports_issue_id_idx` ON `technical_reports` (`issue_id`);--> statement-breakpoint
CREATE INDEX `technical_reports_document_type_idx` ON `technical_reports` (`document_type`);--> statement-breakpoint
CREATE INDEX `technical_reports_release_date_idx` ON `technical_reports` (`release_date`);--> statement-breakpoint
CREATE INDEX `technical_reports_model_name_idx` ON `technical_reports` (`model_name`);