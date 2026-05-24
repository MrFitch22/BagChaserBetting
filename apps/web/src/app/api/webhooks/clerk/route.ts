import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
    username: string | null;
  };
}

export async function POST(request: Request) {
  const webhookSecret = process.env["CLERK_WEBHOOK_SECRET"];
  if (!webhookSecret) return new Response("Webhook secret not configured", { status: 500 });

  const headerPayload = headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await request.text();
  const wh = new Webhook(webhookSecret);
  let event: ClerkUserEvent;

  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, primary_email_address_id, username } = event.data;
    const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id);

    if (primaryEmail) {
      await db
        .insert(users)
        .values({
          clerkId: id,
          email: primaryEmail.email_address,
          username: username ?? undefined,
        })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { email: primaryEmail.email_address, username: username ?? undefined },
        });
    }
  }

  return new Response("OK", { status: 200 });
}
