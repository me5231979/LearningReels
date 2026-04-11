import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Text, Inter, Antonio } from "next/font/google";
import "./globals.css";

const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const antonio = Antonio({
  variable: "--font-antonio",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Learning Reels | Vanderbilt University",
  description:
    "AI-powered professional development, reimagined as interactive micro-learning.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Learning Reels",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1C1C1C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${libreCaslon.variable} ${inter.variable} ${antonio.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-vand-black text-vand-sand font-sans">
        {children}
      </body>
    </html>
  );
}
