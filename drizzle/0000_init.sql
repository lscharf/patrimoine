CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'CTO' NOT NULL,
	`institution` text,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`color` text DEFAULT '#7c5cff' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fx_bars` (
	`pair` text NOT NULL,
	`date` text NOT NULL,
	`rate` real NOT NULL,
	PRIMARY KEY(`pair`, `date`)
);
--> statement-breakpoint
CREATE TABLE `fx_state` (
	`pair` text PRIMARY KEY NOT NULL,
	`rate` real NOT NULL,
	`updated_at` integer NOT NULL,
	`history_through` text
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`instrument_id` integer,
	`label` text NOT NULL,
	`kind` text DEFAULT 'QUOTED' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`note` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `holdings_account_idx` ON `holdings` (`account_id`);--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'EQUITY' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`exchange` text,
	`last_price` real,
	`prev_close` real,
	`last_price_at` integer,
	`history_through` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_symbol_unique` ON `instruments` (`symbol`);--> statement-breakpoint
CREATE TABLE `manual_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`holding_id` integer NOT NULL,
	`date` text NOT NULL,
	`value` real NOT NULL,
	FOREIGN KEY (`holding_id`) REFERENCES `holdings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manual_values_unique` ON `manual_values` (`holding_id`,`date`);--> statement-breakpoint
CREATE TABLE `price_bars` (
	`instrument_id` integer NOT NULL,
	`date` text NOT NULL,
	`close` real NOT NULL,
	PRIMARY KEY(`instrument_id`, `date`),
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`holding_id` integer NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`holding_id`) REFERENCES `holdings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transactions_holding_idx` ON `transactions` (`holding_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);