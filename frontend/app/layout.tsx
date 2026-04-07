import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "InfiniteFlow",
  description: "Lightweight video interpolation SaaS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
