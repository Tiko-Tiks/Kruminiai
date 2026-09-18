import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt";

// Viewport meta tag – be jo mobile naršyklės renderina kaip desktop (980px)
// ir tada zoom-out į ekraną, dėl ko logotipas + tekstas atrodo per visą ekraną.
// Next.js 14 reikalauja atskiro `viewport` eksportu (ne metadata viduje).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#15803d", // Krūminių žalia
};

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
  const locale = normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale}>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <LocaleProvider locale={locale}>
          {children}
          <Toaster position="top-right" richColors />
        </LocaleProvider>
      </body>
    </html>
  );
}
