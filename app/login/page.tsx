"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [vecinoUser, setVecinoUser] = useState("");
  const [vecinoCode, setVecinoCode] = useState("");

  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [loadingVecino, setLoadingVecino] = useState(false);
  const [error, setError] = useState("");

  async function loginAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoadingAdmin(true);

    try {
      const supabase = createClient();

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
      });

      if (authError) {
        throw new Error("Credenciales incorrectas.");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No se pudo obtener el usuario.");
      }

      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", user.id)
        .single();

      if (perfilError || !perfil) {
        throw new Error("Usuario no registrado.");
      }

      if (perfil.rol === "superadmin") {
        router.push("/superadmin");
      } else if (perfil.rol === "admin") {
        router.push("/admin");
      } else {
        throw new Error("Esta cuenta no tiene acceso de administración.");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión.");
    } finally {
      setLoadingAdmin(false);
    }
  }

  async function loginVecino(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoadingVecino(true);

    try {
      const supabase = createClient();
      const username = vecinoUser.trim();

      if (!username) {
        throw new Error("Escribe tu usuario.");
      }

      if (!vecinoCode) {
        throw new Error("Escribe tu código.");
      }

      let emailParaLogin = "";

      const { data: perfilPorUsername } = await supabase
        .from("usuarios")
        .select("email, rol, activo")
        .eq("username", username)
        .maybeSingle();

      if (perfilPorUsername?.email) {
        if (perfilPorUsername.rol !== "vecino") {
          throw new Error("No es cuenta de vecino.");
        }

        if (perfilPorUsername.activo === false) {
          throw new Error("Cuenta inactiva.");
        }

        emailParaLogin = perfilPorUsername.email;
      } else {
        emailParaLogin = `${username}@mibloque.local`;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailParaLogin,
        password: vecinoCode,
      });

      if (authError) {
        throw new Error("Usuario o código incorrecto.");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No se pudo obtener el usuario.");
      }

      const { data: perfilFinal, error: perfilFinalError } = await supabase
        .from("usuarios")
        .select("rol, activo")
        .eq("id", user.id)
        .single();

      if (perfilFinalError || !perfilFinal) {
        await supabase.auth.signOut();
        throw new Error("Usuario no registrado.");
      }

      if (perfilFinal.rol !== "vecino") {
        await supabase.auth.signOut();
        throw new Error("No es cuenta de vecino.");
      }

      if (perfilFinal.activo === false) {
        await supabase.auth.signOut();
        throw new Error("Cuenta inactiva.");
      }

      router.push("/vecino");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión.");
    } finally {
      setLoadingVecino(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#324359] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl bg-[#071426] p-8 text-white shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              MiBloque
            </p>

            <h1 className="mt-3 text-4xl font-bold leading-tight">
              Administración simple para bloques y condominios
            </h1>

            <p className="mt-4 max-w-xl text-slate-300">
              Cobros, pagos, gastos, avisos y transparencia en un solo lugar.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <InfoCard
                title="Cobros ordenados"
                text="Control claro de cuotas, mora y pagos."
              />
              <InfoCard
                title="Transparencia"
                text="Vecinos pueden revisar cuentas y avisos."
              />
              <InfoCard
                title="Menos WhatsApp"
                text="Todo más centralizado y fácil."
              />
              <InfoCard
                title="Acceso simple"
                text="Admin y vecino con ingreso separado."
              />
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-slate-900">
                Iniciar sesión
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Elige tu tipo de acceso
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <form
                onSubmit={loginAdmin}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Acceso administrador
                    </p>
                    <p className="text-sm text-slate-600">
                      Superadmin o administrador del bloque
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Admin
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@mibloque.local"
                      className="w-full px-4 py-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Tu contraseña"
                      className="w-full px-4 py-3"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAdmin}
                    className="btn-primary w-full rounded-2xl px-4 py-3 font-semibold"
                  >
                    {loadingAdmin ? "Ingresando..." : "Entrar como admin"}
                  </button>
                </div>
              </form>

              <form
                onSubmit={loginVecino}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Acceso vecino
                    </p>
                    <p className="text-sm text-slate-600">
                      Usuario simple y código de acceso
                    </p>
                  </div>

                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                    Vecino
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Usuario
                    </label>
                    <input
                      type="text"
                      value={vecinoUser}
                      onChange={(e) => setVecinoUser(e.target.value)}
                      placeholder="24-202"
                      className="w-full px-4 py-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Código
                    </label>
                    <input
                      type="password"
                      value={vecinoCode}
                      onChange={(e) => setVecinoCode(e.target.value)}
                      placeholder="Tu clave"
                      className="w-full px-4 py-3"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loadingVecino}
                    className="btn-primary w-full rounded-2xl px-4 py-3 font-semibold"
                  >
                    {loadingVecino ? "Ingresando..." : "Entrar como vecino"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{text}</p>
    </div>
  );
}