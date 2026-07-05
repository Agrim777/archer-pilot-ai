import { Link } from "wouter";
import { useAuth, UserButton } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Network, 
  Settings, 
  ShieldAlert,
  BotMessageSquare,
  LogOut
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/archer-connection", label: "Connections", icon: Network },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldAlert, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isLoaded, userId } = useAuth();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Replace with real admin check when available
  const isAdmin = true; 

  if (!isLoaded || !userId) return null;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border/40 bg-card flex flex-col z-10 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border/40 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="ArcherPilot Logo" className="h-6 w-auto group-hover:opacity-80 transition-opacity" />
            <span className="font-bold tracking-tight text-lg">ArcherPilot AI</span>
          </Link>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2 mt-2">
            Platform
          </div>
          {NAV_ITEMS.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="block">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}>
                  <item.icon className={cn(
                    "h-4 w-4", 
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {item.label}
                </div>
              </Link>
            );
          })}

          <div className="mt-8 mb-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Assistants
            </div>
            <Link href="/copilot" className="block">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group",
                location.startsWith("/copilot")
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}>
                <BotMessageSquare className="h-4 w-4" />
                Full Copilot
              </div>
            </Link>
          </div>
        </div>

        <div className="p-4 border-t border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-9 w-9",
                  userButtonTrigger: "focus:shadow-none focus:outline-none focus:ring-0"
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
        
        {/* Floating Copilot Button */}
        <Button 
          onClick={() => setIsCopilotOpen(!isCopilotOpen)}
          className={cn(
            "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-all duration-300 z-50 p-0",
            isCopilotOpen ? "rotate-90 scale-90 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        >
          <BotMessageSquare className="h-6 w-6" />
        </Button>
      </main>

      {/* Floating Copilot Panel */}
      <div 
        className={cn(
          "fixed right-0 top-0 bottom-0 w-96 bg-card border-l shadow-2xl z-40 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col",
          isCopilotOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b shrink-0 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <BotMessageSquare className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Copilot</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsCopilotOpen(false)}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {/* Placeholder for the real copilot chat component */}
          <div className="h-full flex flex-col">
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-muted p-3 rounded-lg max-w-[85%] text-sm">
                  Hello! I'm your ArcherPilot AI. How can I assist you with your GRC implementations today?
                </div>
             </div>
             <div className="p-4 border-t shrink-0">
               <div className="flex gap-2">
                 <input type="text" className="flex-1 bg-background border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Ask anything..." />
                 <Button size="icon"><BotMessageSquare className="h-4 w-4" /></Button>
               </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Backdrop for mobile (hidden on desktop) */}
      {isCopilotOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsCopilotOpen(false)}
        />
      )}
    </div>
  );
}
