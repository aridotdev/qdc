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
CREATE INDEX `quality_issues_status_idx` ON `quality_issues` (`status`);--> statement-breakpoint
CREATE INDEX `quality_issues_notification_number_idx` ON `quality_issues` (`notification_number`);--> statement-breakpoint
CREATE INDEX `quality_issues_model_name_idx` ON `quality_issues` (`model_name`);--> statement-breakpoint
CREATE INDEX `quality_issues_tanggal_kejadian_idx` ON `quality_issues` (`tanggal_kejadian`);--> statement-breakpoint
CREATE INDEX `quality_issue_details_issue_id_tanggal_idx` ON `quality_issue_details` (`issue_id`,`tanggal`);--> statement-breakpoint
CREATE INDEX `quality_issue_details_tanggal_idx` ON `quality_issue_details` (`tanggal`);