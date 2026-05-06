import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Caketown ERP",
  description: "Enterprise Attendance & Payroll Management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-50 dark:bg-[#050505] transition-colors duration-300">
       
          <ToastProvider>
            {children}
          </ToastProvider>
      </body>
    </html>
  );
}
