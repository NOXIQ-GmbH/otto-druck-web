CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`key` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`details` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`rate_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_created` ON `submissions` (`created`);--> statement-breakpoint
CREATE INDEX `submission_rate` ON `submissions` (`rate_key`,`created`);