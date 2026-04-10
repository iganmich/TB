import type { Metadata } from "next";
import { JetBrains_Mono, Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { NavRail } from "@/components/nav-rail";
import { TopBar } from "@/components/top-bar";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pionex Trading Bot",
  description: "Buy the Dip + Trailing Stop — XRP/USDT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full flex bg-bg-primary scanlines">
        <NavRail />
        <div className="flex-1 flex flex-col ml-[60px] min-h-screen">
          <TopBar />
          <main className="flex-1 p-6 grid-bg overflow-auto">
            {children}
          </main>
        </div>
        <div className="grain-overlay" aria-hidden />
      </body>
    </html>
  );
}
