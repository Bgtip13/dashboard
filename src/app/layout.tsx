import Providers from "./providers";
import Sidebar from "@/components/Sidebar";
import ShellMain from "@/components/ShellMain";
import Asisten from "@/components/Asisten";
import ShellGate from "@/components/ShellGate";
import "./globals.css";

export const metadata = { title: "PCP Dashboard" };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" as const };

// Set tema sebelum render agar tidak "kedip" putih/gelap
const themeScript = `try{var t=localStorage.getItem("pcp-theme");if(!t){var h=new Date().getHours();t=(h<7||h>=17)?"dark":"light";}if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen antialiased">
        <Providers>
          <div aria-hidden className="app-bg" />
          <ShellGate><Sidebar /></ShellGate>
          <ShellMain>{children}</ShellMain>
          <ShellGate><Asisten /></ShellGate>
        </Providers>
      </body>
    </html>
  );
}
