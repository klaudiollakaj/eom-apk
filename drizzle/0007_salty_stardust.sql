CREATE TABLE "event_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"reported_at" timestamp,
	"report_reason" text,
	"moderated_at" timestamp,
	"moderation_action" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_reviews_event_id_user_id_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_reviews" ADD CONSTRAINT "event_reviews_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reviews" ADD CONSTRAINT "event_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_reviews_event_idx" ON "event_reviews" USING btree ("event_id");