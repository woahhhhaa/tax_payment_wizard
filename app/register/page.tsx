import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main style={{ display: "grid", gap: 24 }}>
      <RegisterForm />
      <p style={{ textAlign: "center", color: "#64748b" }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
