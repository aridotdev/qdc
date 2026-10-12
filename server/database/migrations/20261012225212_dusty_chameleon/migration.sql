ALTER TABLE `quality_issues` ADD `public_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `sample_defects` ADD `public_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `technical_reports` ADD `public_id` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `quality_issues_public_id_unique` ON `quality_issues` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sample_defects_public_id_unique` ON `sample_defects` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `technical_reports_public_id_unique` ON `technical_reports` (`public_id`);