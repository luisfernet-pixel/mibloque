import { redirect } from "next/navigation";

export default function AdminGastosRegistrarRedirectPage() {
  redirect("/admin/gastos/nuevo");
}
