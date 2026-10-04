import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lăng Kính — Philosophy Arena",
  description:
    "Đặt một vấn đề lên bàn, nhìn qua nhiều lăng kính và tự xây dựng lập trường của mình.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
