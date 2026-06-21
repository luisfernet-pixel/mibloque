import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "KUBO",
    template: "%s | KUBO",
  },
  description:
    "Plataforma para administrar bloques y condominios con cuotas, pagos, gastos, avisos y cuentas del bloque para vecinos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = process.env.NEXT_PUBLIC_THEME ?? "ocean";

  return (
    <html lang="es" data-theme={theme}>
      <body className="app-shell font-[system-ui]">{children}</body>
    </html>
  );
}

