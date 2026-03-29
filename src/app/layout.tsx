import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rey30_NEXUS - Motor 3D interactivo",
  description: "Motor de videojuegos 3D con interfaz holográfica para crear escenas, personajes y herramientas visuales.",
  keywords: ["Game Engine", "3D", "Holographic", "TypeScript", "React", "Three.js"],
  authors: [{ name: "Rey30" }],
  openGraph: {
    title: "Rey30_NEXUS - Motor 3D interactivo",
    description: "Motor de videojuegos 3D con interfaz holográfica",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
