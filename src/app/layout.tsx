import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Builder",
  description: "AI-powered prompt builder for image generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
