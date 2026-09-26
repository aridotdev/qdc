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
CREATE INDEX `attachments_detail_id_idx` ON `attachments` (`detail_id`);--> statement-breakpoint
CREATE INDEX `attachments_sample_id_idx` ON `attachments` (`sample_id`);--> statement-breakpoint
CREATE INDEX `attachments_report_id_idx` ON `attachments` (`report_id`);--> statement-breakpoint
CREATE INDEX `attachments_file_type_idx` ON `attachments` (`file_type`);