import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main style={{ display: "grid", gap: 24 }}>
      <LoginForm />
      <p style={{ textAlign: "center", color: "#64748b" }}>
        Need an account? <Link href="/register">Create one</Link>
      </p>
    </main>
  );
}
