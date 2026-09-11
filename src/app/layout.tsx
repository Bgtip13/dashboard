import Providers from "./providers";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata = { title: "PCP Dashboard" };

// Set tema sebelum render agar tidak "kedip" putih/gelap
const themeScript = `try{var t=localStorage.getItem("pcp-theme");if(!t){var h=new Date().getHours();t=(h<7||h>=17)?"dark":"light";}if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen bg-[#0a0e1a] text-slate-100 antialiased">
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 pb-12">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
