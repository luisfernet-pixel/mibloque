import "./globals.css";

export const metadata = {
  title: "MiBloque",
  description: "Sistema simple para administración de bloques y condominios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}