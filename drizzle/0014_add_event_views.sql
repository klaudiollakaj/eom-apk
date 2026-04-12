CREATE TABLE "event_views" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"visitor_id" text,
	"user_id" text,
	"city" text,
	"country" text,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_views" ADD CONSTRAINT "event_views_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;