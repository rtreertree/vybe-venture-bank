import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin investments | VybeVenture Bank",
  description: "Review mock user holdings and investment trade history.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
