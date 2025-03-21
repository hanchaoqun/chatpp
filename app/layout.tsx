/* eslint-disable @next/next/no-page-custom-font */
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/highlight.scss";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0"
        />
        <meta
          name="theme-color"
          content="#151515"
          media="(prefers-color-scheme: dark)"
        />
        <link rel="manifest" href="/site.webmanifest"></link>
        <script src="/serviceWorkerRegister.js" defer></script>
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}

/*
      <link rel="preconnect" href="https://fonts.googleapis.com"></link>
      <link rel="preconnect" href="https://fonts.gstatic.com"></link>
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;700;900&display=swap"
        rel="stylesheet"
      ></link>
 */
