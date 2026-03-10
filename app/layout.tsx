import "./globals.css";
import { Providers } from "@/components/providers";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mirour - Customer Engagement Platform",
  description: "Turn customer participation into long-term loyalty with Mirour's engagement platform.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
