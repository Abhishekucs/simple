import "./globals.css";

export const metadata = {
  title: "Journal",
  description: "A quiet page for writing."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
