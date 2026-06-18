import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BackgroundWorker } from "@/components/shared/BackgroundWorker";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mailer — Outbound Mailing Platform",
  description:
    "Open-source outbound mailing platform with CRM, campaign management, templated emails, SMTP configuration, and intelligent send-gap scheduling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <TooltipProvider delay={300}>
          {children}
        </TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              borderRadius: '12px',
              fontSize: '14px',
              padding: '12px 16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            },
          }}
        />
        <BackgroundWorker />
      </body>
    </html>
  );
}
