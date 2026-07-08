import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vediorgm.com"),
  title: {
    default: "Vedior GM — Recrutement & RH à Djibouti",
    template: "%s | Vedior GM",
  },
  description:
    "Vedior GM est la plateforme de recrutement professionnelle n°1 à Djibouti. Recruteurs, trouvez les meilleurs candidats. Candidats, accédez aux meilleures offres d'emploi à Djibouti.",
  keywords: [
    "recrutement Djibouti",
    "emploi Djibouti",
    "offre emploi Djibouti",
    "agence recrutement Djibouti",
    "Vedior GM",
    "RH Djibouti",
    "candidat Djibouti",
    "travail Djibouti",
    "CDI Djibouti",
    "CDD Djibouti",
    "interim Djibouti",
  ],
  authors: [{ name: "Vedior GM", url: "https://vediorgm.com" }],
  creator: "Vedior GM",
  publisher: "Vedior GM",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_DJ",
    url: "https://vediorgm.com",
    siteName: "Vedior GM",
    title: "Vedior GM — Recrutement & RH à Djibouti",
    description:
      "Plateforme de recrutement professionnelle à Djibouti. Matching IA, gestion des candidats et des offres d'emploi.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Vedior GM — Recrutement Djibouti",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vedior GM — Recrutement Djibouti",
    description: "Plateforme RH n°1 à Djibouti.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "https://vediorgm.com",
    languages: {
      "fr-DJ": "https://vediorgm.com",
      "en-US": "https://vediorgm.com",
      "ar-DJ": "https://vediorgm.com",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        {/* Schema.org JSON-LD — Organisation */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Vedior GM",
              url: "https://vediorgm.com",
              logo: "https://vediorgm.com/logo.png",
              description:
                "Agence de recrutement et plateforme RH à Djibouti.",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Djibouti",
                addressCountry: "DJ",
              },
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Support",
                email: "contact@vediorgm.com",
                availableLanguage: ["French", "Arabic", "English"],
              },
              sameAs: [
                "https://vediorgm.web.app",
              ],
            }),
          }}
        />
        {/* Schema.org JSON-LD — WebSite + SearchAction */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Vedior GM",
              url: "https://vediorgm.com",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate:
                    "https://vediorgm.com/?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}