CREATE TABLE "message_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"flag_type" text NOT NULL,
	"matched_content" text NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_read_receipts" (
	"negotiation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp NOT NULL,
	"last_read_message_id" text NOT NULL,
	CONSTRAINT "message_read_receipts_negotiation_id_user_id_pk" PRIMARY KEY("negotiation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"negotiation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_flags" ADD CONSTRAINT "message_flags_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flags" ADD CONSTRAINT "message_flags_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_last_read_message_id_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_flags_message_idx" ON "message_flags" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_flags_resolved_idx" ON "message_flags" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "messages_negotiation_created_idx" ON "messages" USING btree ("negotiation_id","created_at");