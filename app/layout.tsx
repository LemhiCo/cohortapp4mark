import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lemhi MSP Growth Portal",
    template: "%s · Lemhi MSP Growth Portal",
  },
  description: "Roadmaps, checklists, resources, sessions, and recordings for Lemhi partners.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
