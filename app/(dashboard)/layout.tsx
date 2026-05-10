import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/features/dashboard/Sidebar";
import MobileNav from "@/components/features/dashboard/MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";

  const userProps = {
    firstName: user.firstName ?? "",
    email: primaryEmail,
    imageUrl: user.imageUrl,
  };

  return (
    <div className="flex h-screen bg-[#0F0F1A] overflow-hidden">
      <Sidebar user={userProps} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileNav user={userProps} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
