import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { NavRail } from "@/components/nav-rail";
import { TopBar } from "@/components/top-bar";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pionex Trading Bot",
  description: "Buy the Dip + Trailing Stop — MON/USDT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full flex bg-bg-primary">
        <NavRail />
        <div className="flex-1 flex flex-col ml-[60px] min-h-screen">
          <TopBar />
          <main className="flex-1 p-6 grid-bg overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
