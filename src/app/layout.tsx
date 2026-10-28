import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * URL canónica del sitio. Sale del entorno porque facilapr.cl se sirve sin
 * www (www.facilapr.cl redirige al dominio raíz): si aquí quedara la
 * variante equivocada, Google indexaría una URL que redirige y se diluiría
 * el posicionamiento entre las dos variantes.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.BETTER_AUTH_URL ??
  "https://facilapr.cl";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sistema para APR y SSR (agua potable rural) | Facilapr",
    template: "%s | Facilapr",
  },
  description:
    "Sistema y software para comités de agua potable rural (APR/SSR) en Chile: lecturas, boletas, pagos y cortes, y la cuenta en línea de cada socio. Desde 0,7 UF al mes.",
  keywords: [
    "software APR",
    "sistema de gestión APR",
    "sistema para APR Chile",
    "software agua potable rural",
    "gestión APR Chile",
    "software SSR",
    "servicios sanitarios rurales",
    "boletas agua potable rural",
    "boletas APR",
    "pagos online APR",
    "lecturas de medidor APR",
    "app técnico terreno APR",
    "control de morosidad APR",
    "avisos de corte de agua",
    "sitio web para APR",
    "comité de agua potable rural",
    "sistema para comité de agua",
  ],
  applicationName: "Facilapr",
  appleWebApp: { capable: true, title: "Mi APR", statusBarStyle: "default" },
  authors: [{ name: "Facilapr" }],
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: SITE_URL,
    siteName: "Facilapr",
    title: "Sistema para APR y SSR (agua potable rural) | Facilapr",
    description:
      "Lecturas, boletas, pagos y cortes de tu comité de agua potable rural, y la cuenta en línea de cada socio. Desde 0,7 UF al mes, sin permanencia.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sistema para APR y SSR (agua potable rural) | Facilapr",
    description:
      "Lecturas, boletas, pagos y cortes de tu APR, y la cuenta en línea de cada socio. Desde 0,7 UF al mes.",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Verificación del dominio en Meta (necesaria para verificar el negocio).
  other: { "facebook-domain-verification": "qcxmcz8v7bhk6xu8oss0eqop7pzbs1" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
