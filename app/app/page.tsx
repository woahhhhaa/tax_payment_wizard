import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNewBatch } from "./actions";
import { SignOutButton } from "./SignOutButton";

export default async function AppPage() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?next=/app");
  }

  const [batches, clients] = await Promise.all([
    prisma.batch.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    prisma.client.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 8
    })
  ]);

  return (
    <main style={{ display: "grid", gap: 24 }}>
      <div
        className="card"
        style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            Signed in as {session?.user?.email}
          </p>
        </div>
        <div className="btn-row">
          <Link className="btn" href="/wizard">
            Open Wizard
          </Link>
          <form action={createNewBatch}>
            <button className="btn secondary" type="submit">
              Create New Batch
            </button>
          </form>
          <SignOutButton />
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Recent batches</h2>
          <p style={{ marginTop: 6, color: "#64748b" }}>
            Track the latest batch activity and jump back into the wizard.
          </p>
        </div>
        {batches.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Batch name</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.name}</td>
                  <td>{batch.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#64748b" }}>
            No batches yet. Create one to start saving wizard sessions.
          </p>
        )}
      </div>

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Clients</h2>
          <p style={{ marginTop: 6, color: "#64748b" }}>
            Recently edited clients synced from your wizard runs.
          </p>
        </div>
        {clients.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Entity type</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name || client.addresseeName || "Unnamed"}</td>
                  <td>
                    <span className="pill">{client.entityType || "Unknown"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#64748b" }}>
            Clients will appear here after you save runs in the wizard.
          </p>
        )}
      </div>
    </main>
  );
}
