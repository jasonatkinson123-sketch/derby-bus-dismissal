CREATE TABLE `dismissal` (
	`day` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`calls` text NOT NULL,
	`requests` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `screens` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`revision` integer NOT NULL,
	`seen` integer NOT NULL
);
