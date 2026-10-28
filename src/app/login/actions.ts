"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail, USERNAME_PATTERN } from "@/lib/auth";

// Wrong format or wrong credentials: one message on purpose, so it never says which part was wrong.
const GENERIC = "Utilizador ou palavra-passe incorretos. Verifique e tente novamente.";

export type LoginState = {
  error?: string;
  // Only set for an empty box, the one case where naming the field gives nothing away.
  field?: "username" | "password";
  username?: string;
};

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const typed = String(formData.get("username") ?? "").trim();
  const username = typed.toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!typed) return { error: "Escreva o seu utilizador.", field: "username" };
  if (!password) return { error: "Escreva a sua palavra-passe.", field: "password", username: typed };
  if (!USERNAME_PATTERN.test(username)) return { error: GENERIC, username: typed };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) return { error: GENERIC, username: typed };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/login?message=${encodeURIComponent("Sessão terminada.")}`);
}
