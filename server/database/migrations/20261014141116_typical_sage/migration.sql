CREATE TABLE `business_id_counters` (
	`entity` text NOT NULL,
	`business_date` text NOT NULL,
	`last_sequence` integer NOT NULL,
	CONSTRAINT `business_id_counters_pk` PRIMARY KEY(`entity`, `business_date`)
);
--> statement-breakpoint
ALTER TABLE `quality_issues` ADD `business_id` text;--> statement-breakpoint
ALTER TABLE `sample_defects` ADD `business_id` text;--> statement-breakpoint
ALTER TABLE `technical_reports` ADD `business_id` text;--> statement-breakpoint
WITH numbered AS (
	SELECT
		`id`,
		substr(replace(`created_at`, '-', ''), 1, 8) AS `business_date`,
		row_number() OVER (
			PARTITION BY substr(replace(`created_at`, '-', ''), 1, 8)
			ORDER BY `id`
		) AS `sequence`
	FROM `quality_issues`
	WHERE `business_id` IS NULL
)
UPDATE `quality_issues`
SET `business_id` = (
	SELECT 'QI-' || `business_date` || '-' || printf('%03d', `sequence`)
	FROM `numbered`
	WHERE `numbered`.`id` = `quality_issues`.`id`
)
WHERE `id` IN (SELECT `id` FROM `numbered`);--> statement-breakpoint
WITH numbered AS (
	SELECT
		substr(replace(`created_at`, '-', ''), 1, 8) AS `business_date`,
		row_number() OVER (
			PARTITION BY substr(replace(`created_at`, '-', ''), 1, 8)
			ORDER BY `id`
		) AS `sequence`
	FROM `quality_issues`
)
INSERT INTO `business_id_counters` (`entity`, `business_date`, `last_sequence`)
SELECT 'QI', `business_date`, max(`sequence`)
FROM `numbered`
GROUP BY `business_date`;--> statement-breakpoint
WITH numbered AS (
	SELECT
		`id`,
		substr(replace(`created_at`, '-', ''), 1, 8) AS `business_date`,
		row_number() OVER (
			PARTITION BY substr(replace(`created_at`, '-', ''), 1, 8)
			ORDER BY `id`
		) AS `sequence`
	FROM `sample_defects`
	WHERE `business_id` IS NULL
)
UPDATE `sample_defects`
SET `business_id` = (
	SELECT 'SD-' || `business_date` || '-' || printf('%03d', `sequence`)
	FROM `numbered`
	WHERE `numbered`.`id` = `sample_defects`.`id`
)
WHERE `id` IN (SELECT `id` FROM `numbered`);--> statement-breakpoint
WITH numbered AS (
	SELECT
		substr(replace(`created_at`, '-', ''), 1, 8) AS `business_date`,
		row_number() OVER (
			PARTITION BY substr(replace(`created_at`, '-', ''), 1, 8)
			ORDER BY `id`
		) AS `sequence`
	FROM `sample_defects`
)
INSERT INTO `business_id_counters` (`entity`, `business_date`, `last_sequence`)
SELECT 'SD', `business_date`, max(`sequence`)
FROM `numbered`
GROUP BY `business_date`;--> statement-breakpoint
WITH numbered AS (
	SELECT
		`id`,
		substr(replace(`created_at`, '-', ''), 1, 8) AS `business_date`,
		row_number() OVER (
			PARTITION BY substr(replace(`created_at`, '-', ''), 1, 8)
			ORDER BY `id`
		) AS `sequence`
	FROM `technical_reports`
	WHERE `business_id` IS NULL
)
UPDATE `technical_reports`
SET `business_id` = (
	SELECT 'TR-' || `business_date` || '-' || printf('%03d', `sequence`)
	FROM `numbered`
	WHERE `numbered`.`id` = `technical_reports`.`id`
)
WHERE `id` IN (SELECT `id` FROM `numbered`);--> statement-breakpoint
WITH numbered AS (
	SELECT
		substr(replace(`created_at`, '-', ''), 1, 8) AS `business_date`,
		row_number() OVER (
			PARTITION BY substr(replace(`created_at`, '-', ''), 1, 8)
			ORDER BY `id`
		) AS `sequence`
	FROM `technical_reports`
)
INSERT INTO `business_id_counters` (`entity`, `business_date`, `last_sequence`)
SELECT 'TR', `business_date`, max(`sequence`)
FROM `numbered`
GROUP BY `business_date`;--> statement-breakpoint
CREATE UNIQUE INDEX `quality_issues_business_id_unique` ON `quality_issues` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sample_defects_business_id_unique` ON `sample_defects` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `technical_reports_business_id_unique` ON `technical_reports` (`business_id`);--> statement-breakpoint
CREATE TRIGGER `quality_issues_business_id_insert`
AFTER INSERT ON `quality_issues`
WHEN NEW.`business_id` IS NULL
BEGIN
	INSERT INTO `business_id_counters` (`entity`, `business_date`, `last_sequence`)
	VALUES ('QI', substr(replace(NEW.`created_at`, '-', ''), 1, 8), 1)
	ON CONFLICT(`entity`, `business_date`) DO UPDATE
	SET `last_sequence` = `last_sequence` + 1;

	UPDATE `quality_issues`
	SET `business_id` = 'QI-' || substr(replace(NEW.`created_at`, '-', ''), 1, 8) || '-' || printf(
		'%03d',
		(
			SELECT `last_sequence`
			FROM `business_id_counters`
			WHERE `entity` = 'QI'
				AND `business_date` = substr(replace(NEW.`created_at`, '-', ''), 1, 8)
		)
	)
	WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `sample_defects_business_id_insert`
AFTER INSERT ON `sample_defects`
WHEN NEW.`business_id` IS NULL
BEGIN
	INSERT INTO `business_id_counters` (`entity`, `business_date`, `last_sequence`)
	VALUES ('SD', substr(replace(NEW.`created_at`, '-', ''), 1, 8), 1)
	ON CONFLICT(`entity`, `business_date`) DO UPDATE
	SET `last_sequence` = `last_sequence` + 1;

	UPDATE `sample_defects`
	SET `business_id` = 'SD-' || substr(replace(NEW.`created_at`, '-', ''), 1, 8) || '-' || printf(
		'%03d',
		(
			SELECT `last_sequence`
			FROM `business_id_counters`
			WHERE `entity` = 'SD'
				AND `business_date` = substr(replace(NEW.`created_at`, '-', ''), 1, 8)
		)
	)
	WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `technical_reports_business_id_insert`
AFTER INSERT ON `technical_reports`
WHEN NEW.`business_id` IS NULL
BEGIN
	INSERT INTO `business_id_counters` (`entity`, `business_date`, `last_sequence`)
	VALUES ('TR', substr(replace(NEW.`created_at`, '-', ''), 1, 8), 1)
	ON CONFLICT(`entity`, `business_date`) DO UPDATE
	SET `last_sequence` = `last_sequence` + 1;

	UPDATE `technical_reports`
	SET `business_id` = 'TR-' || substr(replace(NEW.`created_at`, '-', ''), 1, 8) || '-' || printf(
		'%03d',
		(
			SELECT `last_sequence`
			FROM `business_id_counters`
			WHERE `entity` = 'TR'
				AND `business_date` = substr(replace(NEW.`created_at`, '-', ''), 1, 8)
		)
	)
	WHERE `id` = NEW.`id`;
END;
