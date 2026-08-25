ALTER TABLE `fx_state` ADD `history_checked_at` integer;--> statement-breakpoint
ALTER TABLE `fx_state` ADD `history_from` text;--> statement-breakpoint
ALTER TABLE `instruments` ADD `history_checked_at` integer;--> statement-breakpoint
ALTER TABLE `instruments` ADD `history_from` text;