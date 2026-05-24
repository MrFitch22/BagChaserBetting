import Stripe from "stripe";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "", {
  apiVersion: "2024-04-10",
});

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

  if (!sig || !webhookSecret) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const tierByPriceId: Record<string, string> = {
    [process.env["STRIPE_PRICE_PRO"] ?? ""]: "pro",
    [process.env["STRIPE_PRICE_SHARP"] ?? ""]: "sharp",
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id ?? "";
      const newTier = tierByPriceId[priceId] ?? "free";
      const stripeCustomerId = sub.customer as string;

      if (sub.status === "active" || sub.status === "trialing") {
        await db
          .update(users)
          .set({ tier: newTier })
          .where(eq(users.stripeId, stripeCustomerId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db
        .update(users)
        .set({ tier: "free" })
        .where(eq(users.stripeId, sub.customer as string));
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
