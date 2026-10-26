import Providers from "./providers";
import Navbar from "@/components/Navbar";
import Asisten from "@/components/Asisten";
import "./globals.css";

export const metadata = { title: "PCP Dashboard" };

// Set tema sebelum render agar tidak "kedip" putih/gelap
const themeScript = `try{var t=localStorage.getItem("pcp-theme");if(!t){var h=new Date().getHours();t=(h<7||h>=17)?"dark":"light";}if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen antialiased">
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-[88rem] px-4 pb-16 sm:px-8">{children}</main>
          <Asisten />
        </Providers>
      </body>
    </html>
  );
}
