ALTER TABLE "events" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_rule" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_series_parent" boolean DEFAULT false NOT NULL;