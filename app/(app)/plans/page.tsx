import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { WizardShell } from "../wizard/WizardShell";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login?next=/plans");
  }

  return <WizardShell />;
}
