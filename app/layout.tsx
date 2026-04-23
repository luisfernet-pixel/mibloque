import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "MiBloque",
    template: "%s | MiBloque",
  },
  description:
    "Plataforma para administrar bloques y condominios con cuotas, pagos, gastos, avisos y transparencia para vecinos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = process.env.NEXT_PUBLIC_THEME ?? "ocean";

  return (
    <html lang="es" data-theme={theme}>
      <body className="app-shell">{children}</body>
    </html>
  );
}
