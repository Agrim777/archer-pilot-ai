import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Terminal, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Layout, 
  Settings2, 
  Network,
  Database,
  BotMessageSquare
} from "lucide-react";
import { useRef } from "react";

const FEATURES = [
  {
    icon: Terminal,
    title: "Natural Language Generation",
    description: "Describe the GRC application you need in plain English. Our AI understands Archer's architecture and generates full specifications."
  },
  {
    icon: Database,
    title: "Complete Data Models",
    description: "Automatically generates Fields, Value Lists, Cross-References, and complex record permissions tailored to your use case."
  },
  {
    icon: Layout,
    title: "Visual Layouts & Dashboards",
    description: "Proposes intuitive form layouts, reporting structures, and executive dashboards before a single field is built."
  },
  {
    icon: Settings2,
    title: "Workflow & Notifications",
    description: "Maps out multi-stage Advanced Workflows and targeted notifications to ensure process adherence."
  },
  {
    icon: Zap,
    title: "Instant Deployment",
    description: "Connect securely to your Archer instance and deploy the entire application structure with one click via our deployment engine."
  },
  {
    icon: Network,
    title: "Cross-Reference Mapping",
    description: "Intelligently identifies and creates relationships to existing Core modules and applications in your instance."
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Grade",
    description: "Built for GRC professionals. Follows Archer best practices, naming conventions, and performance guidelines by default."
  },
  {
    icon: Cpu,
    title: "AI Copilot",
    description: "A persistent expert assistant that helps you refine models, write calculations, and troubleshoot complex Archer specific issues."
  }
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen bg-[#020205] text-foreground selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="Logo" className="h-6 w-auto" />
            <span className="font-bold tracking-tight text-lg text-white">ArcherPilot</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Button asChild size="sm" className="bg-white text-black hover:bg-zinc-200">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden pt-16">
        <motion.div 
          style={{ y, opacity }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center opacity-[0.15] mix-blend-screen" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-[#020205]/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020205] via-transparent to-[#020205]" />
        </motion.div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium tracking-wide mb-8 uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Intelligence for GRC
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-6 leading-[1.1]">
              Build Archer apps in <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-600">
                minutes, not months.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Describe your GRC requirements. ArcherPilot AI designs the data model, workflows, and layouts, then deploys directly to your instance. Precision meets unprecedented speed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="h-12 px-8 text-base bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                <Link href="/sign-up">
                  Start Building <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-8 text-base border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white">
                View Documentation
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Demo UI Mockup */}
      <section className="relative z-20 -mt-20 md:-mt-32 px-6 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-6xl mx-auto rounded-xl overflow-hidden border border-zinc-800 bg-[#09090b] shadow-[0_0_50px_rgba(79,70,229,0.15)] ring-1 ring-white/5"
        >
          <div className="h-12 bg-[#121214] border-b border-zinc-800 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
            <div className="ml-4 px-3 py-1 bg-black/50 rounded-md text-xs text-zinc-500 font-mono border border-zinc-800/50 flex-1 max-w-sm">
              archerpilot.ai/projects/new
            </div>
          </div>
          <div className="p-1 md:p-8 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#09090b] z-10 pointer-events-none h-full" />
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" 
              alt="App Interface" 
              className="w-full h-auto rounded-md opacity-20 filter grayscale contrast-125"
            />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-full max-w-2xl px-4">
              <div className="bg-[#121214]/90 backdrop-blur-md border border-indigo-500/30 rounded-lg p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <BotMessageSquare className="h-5 w-5 text-indigo-400" />
                  <span className="text-sm font-medium text-zinc-200">Generating Architecture...</span>
                </div>
                <div className="space-y-3">
                  <div className="h-2 bg-zinc-800 rounded-full w-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-2/3 shadow-[0_0_10px_rgba(79,70,229,0.8)]" />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-zinc-500">
                    <span>Compiling Fields [42/42]</span>
                    <span className="text-indigo-400">1.2s</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono text-zinc-500">
                    <span>Generating Value Lists [8/8]</span>
                    <span className="text-indigo-400">0.8s</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono text-zinc-500">
                    <span>Mapping Cross-References...</span>
                    <span className="text-zinc-600 animate-pulse">Running</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-24 relative border-t border-zinc-900 bg-[#050508] overflow-hidden">
        <div className="absolute inset-0 bg-[url('/features-bg.png')] bg-cover bg-center opacity-[0.05] mix-blend-screen" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
              A Complete GRC Engineering Toolkit
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
              Stop clicking through endless configuration screens. ArcherPilot turns your expertise into working software instantly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-[#09090b] border border-zinc-800/50 p-6 rounded-2xl hover:border-indigo-500/30 hover:bg-[#0c0c0e] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/30 transition-colors">
                  <feature.icon className="h-5 w-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-900/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            Ready to revolutionize your Archer delivery?
          </h2>
          <p className="text-xl text-indigo-200/70 mb-10">
            Join the top GRC consultancies delivering better applications, faster.
          </p>
          <Button asChild size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-200 border-0 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            <Link href="/sign-up">Create Free Account</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-black py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Logo" className="h-5 w-auto grayscale opacity-50" />
            <span className="font-semibold text-zinc-500">ArcherPilot</span>
          </div>
          <div className="flex gap-6 text-sm text-zinc-600">
            <a href="#" className="hover:text-zinc-300">Privacy</a>
            <a href="#" className="hover:text-zinc-300">Terms</a>
            <a href="#" className="hover:text-zinc-300">Documentation</a>
          </div>
          <div className="text-sm text-zinc-600">
            © {new Date().getFullYear()} ArcherPilot AI. Not affiliated with RSA Security.
          </div>
        </div>
      </footer>
    </div>
  );
}
