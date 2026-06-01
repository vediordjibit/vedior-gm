import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vedior GM — Recrutement à Djibouti",
  description: "Vedior GM connecte les talents avec les entreprises leaders à Djibouti depuis 2009.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={{ background: 'transparent' }}>
        {children}
      </body>
    </html>
  );
}