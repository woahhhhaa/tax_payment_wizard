import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main style={{ display: "grid", gap: 24 }}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p style={{ textAlign: "center", color: "#64748b" }}>
        Need an account? <Link href="/register">Create one</Link>
      </p>
    </main>
  );
}
