CREATE TABLE `monitoring` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`fiscal` text NOT NULL,
	`total` integer NOT NULL,
	`ok` integer NOT NULL,
	`ng` integer NOT NULL,
	`categoryId` integer NOT NULL,
	`createdAt` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
