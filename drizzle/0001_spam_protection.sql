CREATE TABLE `mail_deliveries` (
	`job_id` text NOT NULL,
	`audience` text NOT NULL,
	`state` text NOT NULL,
	`provider_id` text,
	`updated` integer NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`job_id`, `audience`)
);
--> statement-breakpoint
CREATE INDEX `mail_delivery_expiry` ON `mail_deliveries` (`expires`);--> statement-breakpoint
CREATE TABLE `protection_counters` (
	`scope` text NOT NULL,
	`subject` text NOT NULL,
	`window` integer NOT NULL,
	`hits` integer NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`scope`, `subject`, `window`)
);
--> statement-breakpoint
CREATE INDEX `protection_counter_expiry` ON `protection_counters` (`expires`);--> statement-breakpoint
CREATE TABLE `protection_events` (
	`id` text PRIMARY KEY NOT NULL,
	`form` text NOT NULL,
	`code` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `protection_event_expiry` ON `protection_events` (`expires`);--> statement-breakpoint
CREATE TABLE `protection_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`form` text NOT NULL,
	`digest` text NOT NULL,
	`state` text NOT NULL,
	`result` text,
	`created` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `protection_job_digest` ON `protection_jobs` (`form`,`digest`);--> statement-breakpoint
CREATE INDEX `protection_job_expiry` ON `protection_jobs` (`expires`);--> statement-breakpoint
CREATE TABLE `protection_tokens` (
	`digest` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `protection_token_expiry` ON `protection_tokens` (`expires`);--> statement-breakpoint
ALTER TABLE `files` ADD `scan_status` text DEFAULT 'unscanned' NOT NULL;--> statement-breakpoint
ALTER TABLE `files` ADD `content_sha256` text;