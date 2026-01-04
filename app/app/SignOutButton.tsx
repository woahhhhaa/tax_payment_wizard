"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button className="btn secondary" type="button" onClick={() => signOut()}>
      Sign out
    </button>
  );
}
