CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"event_service_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewee_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"type" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"reported_at" timestamp,
	"report_reason" text,
	"moderated_at" timestamp,
	"moderation_action" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_event_service_id_reviewer_id_unique" UNIQUE("event_service_id","reviewer_id")
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_event_service_id_event_services_id_fk" FOREIGN KEY ("event_service_id") REFERENCES "public"."event_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;