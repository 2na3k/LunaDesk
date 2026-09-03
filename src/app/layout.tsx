import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LunaDesk",
  description: "A multi-agent chat desktop app powered by the Pi coding-agent stack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
