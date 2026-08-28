CREATE TABLE `loans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`type` text DEFAULT 'AMORTIZING' NOT NULL,
	`borrowed_amount` real NOT NULL,
	`down_payment` real DEFAULT 0 NOT NULL,
	`initial_fees` real DEFAULT 0 NOT NULL,
	`interest_rate` real DEFAULT 0 NOT NULL,
	`insurance_rate` real DEFAULT 0 NOT NULL,
	`duration_months` integer NOT NULL,
	`start_date` text NOT NULL,
	`custom_monthly_payment` real,
	`account_id` integer,
	`holding_id` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`holding_id`) REFERENCES `holdings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `loans_user_idx` ON `loans` (`user_id`);