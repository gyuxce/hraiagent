import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.slogan}`,
  description: BRAND.tagline,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: `${BRAND.name} — ${BRAND.slogan}`,
    description: BRAND.tagline,
    images: [{ url: BRAND.assets.og, width: 1200, height: 630, alt: BRAND.name }],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.slogan}`,
    description: BRAND.tagline,
    images: [BRAND.assets.og],
  },
  icons: {
    icon: [{ url: BRAND.assets.logoMark, type: "image/svg+xml" }],
    apple: BRAND.assets.logoRaster,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jakarta.className} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body
        className={`${jakarta.className} flex min-h-full flex-col bg-mist font-sans text-ink`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
