import type { Metadata } from "next";
import { ViewTransition } from 'react';
import { Playfair_Display } from "next/font/google";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "문장군 디지털 쇼룸",
  description: "영업사원이 현장 컬러북을 넘어서 보내는 프리미엄 디지털 쇼룸",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={playfairDisplay.variable}>
      <body>
        <ViewTransition
          enter={{
            'nav-forward': 'nav-forward',
            'nav-back': 'nav-back',
            default: 'page-soft-enter',
          }}
          exit={{
            'nav-forward': 'nav-forward',
            'nav-back': 'nav-back',
            default: 'page-soft-exit',
          }}
        >
          {children}
        </ViewTransition>
      </body>
    </html>
  );
}
