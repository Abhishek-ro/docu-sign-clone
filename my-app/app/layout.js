import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google"; // Keep Inter if you plan to use it elsewhere, or remove if only Geist is needed
import "./globals.css";
import { Toaster } from "react-hot-toast"; // Import Toaster

const inter = Inter({ subsets: ["latin"] }); // Keep or remove based on font usage

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "DocuSign Clone",
  description: "A simplified document signing application",
};

// This is the SINGLE and CORRECT default export
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        // Combine Geist fonts with Inter if desired, or choose one set of fonts.
        // For simplicity, I'm combining them here. If you prefer ONLY Geist,
        // you can remove `inter.className` and `const inter = Inter(...)` line above.
        className={`${inter.className} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster position="top-right" reverseOrder={false} />{" "}
        {/* Ensure Toaster is included */}
      </body>
    </html>
  );
}
