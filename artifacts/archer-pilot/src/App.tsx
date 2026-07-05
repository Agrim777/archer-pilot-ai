import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryClient } from "./lib/queryClient";

import LandingPage from "./pages/landing";
import DashboardPage from "./pages/dashboard";
import ProjectsPage from "./pages/projects";
import ProjectNewPage from "./pages/project-new";
import ProjectDetailPage from "./pages/project-detail";
import ProjectDeployPage from "./pages/project-deploy";
import ArcherConnectionPage from "./pages/archer-connection";
import SettingsPage from "./pages/settings";
import AdminPage from "./pages/admin";
import CopilotPage from "./pages/copilot";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(243 75% 59%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(240 5% 65%)",
    colorDanger: "hsl(0 62% 30%)",
    colorBackground: "hsl(240 6% 7%)",
    colorInput: "hsl(240 6% 15%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorNeutral: "hsl(240 6% 15%)",
    fontFamily: "'Outfit', sans-serif",
    borderRadius: "0.35rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#09090b] border border-[#27272a] rounded-xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-semibold tracking-tight",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButtonText: "text-zinc-200 font-medium",
    formFieldLabel: "text-zinc-200 font-medium",
    footerActionLink: "text-indigo-400 hover:text-indigo-300 font-medium",
    footerActionText: "text-zinc-400",
    dividerText: "text-zinc-500",
    identityPreviewEditButton: "text-indigo-400",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-white",
    logoBox: "mb-2",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors",
    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors",
    formFieldInput: "bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500",
    footerAction: "bg-zinc-950 border-t border-zinc-900",
    dividerLine: "bg-zinc-800",
    alert: "bg-red-950 border border-red-900",
    otpCodeFieldInput: "bg-zinc-900 border border-zinc-800 text-white focus:ring-indigo-500",
    formFieldRow: "mb-4",
    main: "px-8 py-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/features-bg.png')] bg-cover bg-center opacity-10 mix-blend-screen pointer-events-none"></div>
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/features-bg.png')] bg-cover bg-center opacity-10 mix-blend-screen pointer-events-none"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Sign in to ArcherPilot AI",
            subtitle: "Enter your details to access your workspace",
          },
        },
        signUp: {
          start: {
            title: "Create your workspace",
            subtitle: "Start generating Archer applications in seconds",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
            <Route path="/projects"><ProtectedRoute component={ProjectsPage} /></Route>
            <Route path="/projects/new"><ProtectedRoute component={ProjectNewPage} /></Route>
            <Route path="/projects/:id/deploy"><ProtectedRoute component={ProjectDeployPage} /></Route>
            <Route path="/projects/:id"><ProtectedRoute component={ProjectDetailPage} /></Route>
            <Route path="/archer-connection"><ProtectedRoute component={ArcherConnectionPage} /></Route>
            <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
            <Route path="/admin"><ProtectedRoute component={AdminPage} /></Route>
            <Route path="/copilot"><ProtectedRoute component={CopilotPage} /></Route>
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class" storageKey="archer-pilot-theme">
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
