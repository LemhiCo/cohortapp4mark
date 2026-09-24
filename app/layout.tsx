import type { Metadata } from "next";
import { DM_Sans, EB_Garamond } from "next/font/google";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  display: "swap",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Lemhi Cohort Portal",
    template: "%s · Lemhi Cohort Portal",
  },
  description: "Cohort schedules, checklists, resources, and recordings for Lemhi partners.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${ebGaramond.variable}`}>
      <body>{children}</body>
    </html>
  );
}
