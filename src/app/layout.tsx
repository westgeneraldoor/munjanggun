import type { Metadata } from "next";
import { ViewTransition } from 'react';
import { Playfair_Display } from "next/font/google";
import { createPublicShowroomClient, hasPublicShowroomEnv } from "@/lib/supabase/public";
import { getSiteUrl } from "@/lib/content-os/site-url";
import "./globals.css";

const FALLBACK_SITE_TITLE = "문장군"
const FALLBACK_SITE_DESCRIPTION = "좋은 문을 고르는 일, 어렵지 않게 도와드립니다."

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

export async function generateMetadata(): Promise<Metadata> {
  if (!hasPublicShowroomEnv()) {
    return {
      metadataBase: new URL(getSiteUrl()),
      title: FALLBACK_SITE_TITLE,
      description: FALLBACK_SITE_DESCRIPTION,
      openGraph: {
        title: FALLBACK_SITE_TITLE,
        description: FALLBACK_SITE_DESCRIPTION,
        images: [],
      },
    }
  }

  const supabase = createPublicShowroomClient()
  const { data: siteSettings } = await supabase
    .schema('showroom')
    .from('site_settings')
    .select('site_title, site_description, og_image_url')
    .single()

  const title = siteSettings?.site_title || FALLBACK_SITE_TITLE
  const description = siteSettings?.site_description || FALLBACK_SITE_DESCRIPTION
  
  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description,
    openGraph: {
      title,
      description,
      images: siteSettings?.og_image_url ? [{ url: siteSettings.og_image_url }] : [],
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={playfairDisplay.variable}>
      <body>
        <ViewTransition>
          {children}
        </ViewTransition>
      </body>
    </html>
  );
}
