import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sharp Edge — Sports Betting Analytics",
    template: "%s | Sharp Edge",
  },
  description:
    "Pick accountability, parlay intelligence, and live prediction. Know who's actually winning.",
  openGraph: {
    type: "website",
    siteName: "Sharp Edge",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
