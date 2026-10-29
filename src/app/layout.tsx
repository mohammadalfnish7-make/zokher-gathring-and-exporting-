import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Link from "next/link";
import { UiScaleControl } from "@/components/UiScaleControl";
import "./globals.css";

const sans = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Zokher DR Converter",
  description:
    "Convert Fragrance World packing Excel files into Russian pivot PDFs with agent verification.",
  icons: {
    icon: "/brand/karam-alarab-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col antialiased">
        <header className="sticky top-0 z-50 shrink-0 border-b border-[var(--line)] bg-white/90 shadow-sm backdrop-blur-md">
          <div className="site-header-inner mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/karam-alarab-logo.svg"
                alt="Karam Al Arab"
                width={160}
                height={28}
                className="h-7 w-auto"
              />
              <span className="hidden h-6 w-px bg-[var(--line)] sm:block" />
              <span className="hidden text-sm font-medium text-[var(--muted)] sm:inline">
                Gathering & Exporting · DR Excel→PDF
              </span>
            </Link>
            <nav className="flex items-center gap-3 text-sm sm:gap-4">
              <UiScaleControl />
              <Link
                href="/"
                className="font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
              >
                Upload
              </Link>
              <Link
                href="/history"
                className="font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
              >
                History
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-3">
          {children}
        </main>
      </body>
    </html>
  );
}
