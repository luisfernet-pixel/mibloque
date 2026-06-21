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
        className="whitespace-nowrap rounded-xl border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-100 transition duration-200 hover:border-sky-400/30 hover:bg-white/20 hover:text-white active:scale-[0.98] md:rounded-2xl md:px-3 md:py-1.5 md:text-xs [@media(max-height:820px)]:px-2 [@media(max-height:820px)]:py-1 [@media(max-height:820px)]:text-[10px]"
      >
        Cerrar sesion
      </button>
    </form>
  );
}

