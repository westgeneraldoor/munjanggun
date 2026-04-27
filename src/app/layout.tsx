import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient()
  const { data: siteSettings } = await supabase
    .schema('colorbook')
    .from('site_settings')
    .select('site_title, site_description, og_image_url')
    .single()

  const title = siteSettings?.site_title || "문장군 디지털 컬러북"
  const description = siteSettings?.site_description || "영업사원이 현장 컬러북을 넘어서 보내는 프리미엄 디지털 쇼룸"
  
  return {
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
      <body>{children}</body>
    </html>
  );
}
