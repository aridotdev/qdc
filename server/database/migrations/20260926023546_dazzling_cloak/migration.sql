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
CREATE INDEX `sample_defects_batch_id_idx` ON `sample_defects` (`batch_id`);--> statement-breakpoint
CREATE INDEX `sample_defects_issue_id_idx` ON `sample_defects` (`issue_id`);--> statement-breakpoint
CREATE INDEX `sample_defects_notification_number_idx` ON `sample_defects` (`notification_number`);--> statement-breakpoint
CREATE INDEX `sample_defects_status_idx` ON `sample_defects` (`status`);--> statement-breakpoint
CREATE INDEX `sample_defects_model_name_part_number_idx` ON `sample_defects` (`model_name`,`part_number`);