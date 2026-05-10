import { Webhook } from "svix";
import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { isDisposableEmail } from "@/lib/disposable-email-domains";

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
  };
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET manquant");
    return new Response("Configuration serveur manquante", { status: 500 });
  }

  const headersList = await headers();
  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Headers svix manquants", { status: 400 });
  }

  const body = await req.text();

  const wh = new Webhook(webhookSecret);
  let evt: ClerkUserCreatedEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return new Response("Signature invalide", { status: 401 });
  }

  if (evt.type !== "user.created") {
    return new Response("Event ignoré", { status: 200 });
  }

  const primaryEmail = evt.data.email_addresses[0]?.email_address;
  if (!primaryEmail) {
    return new Response("Email introuvable", { status: 200 });
  }

  if (isDisposableEmail(primaryEmail)) {
    console.warn(
      `[clerk-webhook] Email jetable détecté : ${primaryEmail} — suppression compte ${evt.data.id}`
    );
    const client = await clerkClient();
    await client.users.deleteUser(evt.data.id);
  }

  return new Response("OK", { status: 200 });
}
