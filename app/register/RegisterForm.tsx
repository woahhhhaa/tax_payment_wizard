"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const resp = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setError(data?.error || "Unable to create account.");
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/app"
    });

    setLoading(false);
    router.push("/app");
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h1 style={{ marginTop: 0 }}>Create account</h1>
      <label>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p style={{ color: "#dc2626" }}>{error}</p> : null}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create account"}
      </button>
    </form>
  );
}
