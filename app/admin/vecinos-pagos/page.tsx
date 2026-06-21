import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function VecinosPagosPage() {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  redirect("/admin/pagos");
}
