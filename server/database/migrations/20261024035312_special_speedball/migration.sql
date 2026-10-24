PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `attachments_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`public_id` text NOT NULL,
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
);--> statement-breakpoint
WITH migrated AS (
	SELECT
		`id`,
		'ATT-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-7' ||
		substr(lower(hex(randomblob(2))), 2) || '-' ||
		substr('89ab', abs(random()) % 4 + 1, 1) ||
		substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) AS `public_id`,
		`detail_id`, `sample_id`, `report_id`, `file_name`, `storage_name`, `file_url`,
		`file_type`, `file_size`, `created_at`, `updated_at`, `created_by_user_id`,
		`updated_by_user_id`
	FROM `attachments`
)
INSERT INTO `attachments_new` (
	`id`, `public_id`, `detail_id`, `sample_id`, `report_id`, `file_name`,
	`storage_name`, `file_url`, `file_type`, `file_size`, `created_at`,
	`updated_at`, `created_by_user_id`, `updated_by_user_id`
)
SELECT `id`, `public_id`, `detail_id`, `sample_id`, `report_id`, `file_name`,
	`storage_name`, `file_url`, `file_type`, `file_size`, `created_at`,
	`updated_at`, `created_by_user_id`, `updated_by_user_id`
FROM migrated;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `attachments_new` RENAME TO `attachments`;--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_public_id_unique` ON `attachments` (`public_id`);--> statement-breakpoint
CREATE INDEX `attachments_detail_id_idx` ON `attachments` (`detail_id`);--> statement-breakpoint
CREATE INDEX `attachments_sample_id_idx` ON `attachments` (`sample_id`);--> statement-breakpoint
CREATE INDEX `attachments_report_id_idx` ON `attachments` (`report_id`);--> statement-breakpoint
CREATE INDEX `attachments_file_type_idx` ON `attachments` (`file_type`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
