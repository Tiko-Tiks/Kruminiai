import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Krūminių kaimo bendruomenė",
    template: "%s | Krūminių kaimo bendruomenė",
  },
  description:
    "Krūminių kaimo bendruomenės oficialus puslapis – naujienos, susirinkimai, dokumentai, skaidrumas ir narystės informacija. Varėnos r., Krūminių k.",
  applicationName: "Krūminių kaimo bendruomenė",
  authors: [{ name: "Krūminių kaimo bendruomenė" }],
  keywords: [
    "Krūminiai",
    "Krūminių kaimas",
    "Krūminių bendruomenė",
    "Varėnos rajonas",
    "kaimo bendruomenė",
    "Valkininkai",
    "socialinis verslas",
    "bendruomenės skaidrumas",
    "Krūminių pirtis",
    "Krūminių SPA",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "lt_LT",
    url: SITE_URL,
    siteName: "Krūminių kaimo bendruomenė",
    title: "Krūminių kaimo bendruomenė",
    description:
      "Kartu kuriame savo kaimą. Naujienos, susirinkimai, dokumentai ir skaidri bendruomenės veikla.",
    images: [
      {
        url: "/images/logo-md.png",
        width: 512,
        height: 512,
        alt: "Krūminių kaimo bendruomenė",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Krūminių kaimo bendruomenė",
    description:
      "Kartu kuriame savo kaimą. Naujienos, susirinkimai, dokumentai ir skaidri bendruomenės veikla.",
    images: ["/images/logo-md.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  category: "community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lt">
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
