import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
      <div className="space-y-5">
        <Badge variant="secondary" className="w-fit bg-secondary/70">
          Welcome back
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sign in</h1>
          <p className="text-muted-foreground">
            Open your dashboard to manage batches, publish checklists, and track confirmations.
          </p>
        </div>

        <div className="grid gap-3">
          {[
            {
              title: "Payments board",
              description: "Filter by due date and status with a clean, readable table."
            },
            {
              title: "Client checklist portal",
              description: "Generate a secure link clients can use to confirm payments."
            },
            {
              title: "Consistent UI",
              description: "Cards, forms, and tables that feel cohesive across the app."
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
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/register">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
