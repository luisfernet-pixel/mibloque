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
        className="whitespace-nowrap rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition duration-200 hover:border-sky-400/30 hover:bg-white/20 hover:text-white active:scale-[0.98] md:rounded-2xl md:px-4 md:py-2 md:text-sm"
      >
        Cerrar sesion
      </button>
    </form>
  );
}
