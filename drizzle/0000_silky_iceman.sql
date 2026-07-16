CREATE TABLE `product_metrics` (
	`day` text NOT NULL,
	`event` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `event`)
);
