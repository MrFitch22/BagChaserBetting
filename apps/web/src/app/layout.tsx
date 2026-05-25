import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BagChaser — Sports Betting Analytics",
    template: "%s | BagChaser",
  },
  description:
    "Pick accountability, parlay intelligence, and live prediction. Know who's actually winning.",
  openGraph: {
    type: "website",
    siteName: "BagChaser",
  },
};

const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("...")
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (!hasClerk) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
