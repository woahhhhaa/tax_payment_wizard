import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card" style={{ display: "grid", gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Tax Payment Wizard</h1>
          <p style={{ color: "#475569", marginTop: 12 }}>
            A secure workspace for accountants to build payment schedules, generate
            client drafts, and collaborate across batches.
          </p>
        </div>
        <div className="btn-row">
          <Link className="btn" href="/login">
            Log in
          </Link>
          <Link className="btn secondary" href="/register">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
