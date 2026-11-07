import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coconut",
  description: "Coconut web app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
