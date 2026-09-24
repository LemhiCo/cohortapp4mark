import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lemhi Cohort Portal",
    template: "%s · Lemhi Cohort Portal",
  },
  description: "Cohort schedules, checklists, resources, and recordings for Lemhi partners.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
