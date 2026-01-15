import "./globals.css";
import React from "react";

export const metadata = {
  title: "Text RPG MVP",
  description: "HUD + чат + кнопки 1–4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
