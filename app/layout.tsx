import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";

// Inter Tight: the closest match to the PDF lettering (docs/decisions.md).
const font = Inter_Tight({ variable: "--font-app", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Vertex OS", template: "%s · Vertex OS" },
  description: "Operations for Vertex Media House and Vertex Tech House",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
