import Link from "next/link";
import { RegisterForm } from "./RegisterForm";
import { Badge } from "@/components/ui/badge";

export default function RegisterPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
      <div className="space-y-5">
        <Badge variant="secondary" className="w-fit bg-secondary/70">
          Get started
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create your workspace</h1>
          <p className="text-muted-foreground">
            Create an account to start building schedules, publishing checklists, and tracking payments.
          </p>
        </div>

        <div className="grid gap-3">
          {[
            {
              title: "Client plan workspace",
              description: "Build payment plans in one polished flow from intake to publication."
            },
            {
              title: "Better visibility for due dates",
              description: "Use the payments board to stay ahead of upcoming deadlines."
            },
            {
              title: "Client-friendly confirmations",
              description: "A simple portal so clients can mark payments as paid."
            }
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card/60 p-4 backdrop-blur">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-md space-y-6 lg:justify-self-end">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/login">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
