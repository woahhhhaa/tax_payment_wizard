import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WizardPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login?next=/wizard");
  }

  redirect("/tax_payment_wizard_new.html");
}
