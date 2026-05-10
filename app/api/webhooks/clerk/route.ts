import { Webhook } from "svix";
import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { isDisposableEmail } from "@/lib/disposable-email-domains";

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    primary_email_address_id: string;
    email_addresses: Array<{ id: string; email_address: string }>;
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

  const primaryEmail = evt.data.email_addresses.find(
    (e) => e.id === evt.data.primary_email_address_id
  )?.email_address ?? evt.data.email_addresses[0]?.email_address;
  if (!primaryEmail) {
    return new Response("Email introuvable", { status: 200 });
  }

  if (isDisposableEmail(primaryEmail)) {
    console.warn(
      `[clerk-webhook] Email jetable détecté : ${primaryEmail} — suppression compte ${evt.data.id}`
    );
    try {
      const client = await clerkClient();
      await client.users.deleteUser(evt.data.id);
    } catch (err) {
      console.error("[clerk-webhook] Erreur suppression compte:", err);
      return new Response("Erreur suppression", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
