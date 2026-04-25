"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/email-domain";

export default function LoginPage() {
  const router = useRouter();

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [vecinoUser, setVecinoUser] = useState("");
  const [vecinoCode, setVecinoCode] = useState("");

  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [loadingVecino, setLoadingVecino] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        if (!cancelled) {
          setCheckingSession(false);
        }
        return;
      }

      const { data: perfil } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (perfil?.rol === "superadmin") {
        router.replace("/superadmin");
        return;
      }

      if (perfil?.rol === "admin") {
        router.replace("/admin");
        return;
      }

      if (perfil?.rol === "vecino") {
        router.replace("/vecino");
        return;
      }

      setCheckingSession(false);
    }

    void checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <main className="theme-shell flex min-h-screen items-center justify-center px-4">
        <div className="theme-hero rounded-3xl border border-white/10 px-6 py-5 text-sm font-semibold text-white shadow-2xl">
          Verificando acceso...
        </div>
      </main>
    );
  }

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
        throw new Error("Esta cuenta no tiene acceso de administraciÃƒÂ³n.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesiÃƒÂ³n.");
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
        throw new Error("Escribe tu cÃƒÂ³digo.");
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
        emailParaLogin = `${username}@${INTERNAL_EMAIL_DOMAIN}`;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailParaLogin,
        password: vecinoCode,
      });

      if (authError) {
        throw new Error("Usuario o cÃƒÂ³digo incorrecto.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesiÃƒÂ³n.");
    } finally {
      setLoadingVecino(false);
    }
  }

  return (
    <main className="theme-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
          <section className="theme-panel rounded-3xl p-6 shadow-2xl">
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-white">
                Iniciar sesiÃƒÂ³n
              </h2>
              <p className="mt-2 text-sm text-slate-300">
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
                className="theme-panel-soft rounded-3xl border border-white/10 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                      <p className="font-semibold text-white">
                        Acceso administrador
                      </p>
                    <p className="text-sm text-slate-300">
                      Superadmin o administrador del bloque
                    </p>
                  </div>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    Admin
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Email
                      </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder={`admin@${INTERNAL_EMAIL_DOMAIN}`}
                      className="w-full px-4 py-3"
                      required
                    />
                  </div>

                  <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        ContraseÃƒÂ±a
                      </label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Tu contraseÃƒÂ±a"
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
                className="theme-panel-soft rounded-3xl border border-white/10 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                      <p className="font-semibold text-white">
                        Acceso vecino
                      </p>
                    <p className="text-sm text-slate-300">
                      Usuario simple y cÃƒÂ³digo de acceso
                    </p>
                  </div>

                  <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-semibold text-cyan-100">
                    Vecino
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
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
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        CÃƒÂ³digo
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
    </main>
  );
}
