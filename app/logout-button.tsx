import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function logout() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect("/login");
}

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-2xl border border-white/10 bg-white/50/40 px-4 py-2 text-sm font-medium text-slate-200 transition duration-200 hover:border-sky-400/30 hover:bg-white/20 hover:text-white active:scale-[0.98]"
      >
        Cerrar sesión
      </button>
    </form>
  );
}