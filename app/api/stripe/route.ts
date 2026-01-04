import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Stripe billing scaffolding placeholder."
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Stripe billing is not yet configured." },
    { status: 501 }
  );
}
