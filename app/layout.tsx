import type { Metadata } from "next"
import "./globals.css"
import "./receipt-print.css"
import "./parent-portal.css"

export const metadata: Metadata = {
  title: "Kid Seeds Hub",
  description: "Kid Seeds Hub Management System"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
