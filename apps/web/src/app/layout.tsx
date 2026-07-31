import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NameStack",
  description: "Decentralized domain name escrow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
