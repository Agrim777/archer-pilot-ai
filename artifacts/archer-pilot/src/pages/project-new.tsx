import { AppLayout } from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useGenerateArcherImplementation, useCreateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Sparkles, Loader2, Code2, Database, Layout } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const SUGGESTIONS = [
  "Build a Vendor Risk Management app that tracks third-party vendors, issues risk assessments, and calculates a vendor risk score based on answers.",
  "Create an IT Exception Management tracker. Needs to relate to Policy and Control modules, and have a multi-stage approval workflow.",
  "Design a Business Continuity Plan application with fields for RTO, RPO, and a sub-form for emergency contacts."
];

export default function ProjectNewPage() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const generateMutation = useGenerateArcherImplementation();
  const createMutation = useCreateProject();
  
  const STEPS = [
    { icon: Bot, text: "Analyzing requirements..." },
    { icon: Database, text: "Designing data model..." },
    { icon: Code2, text: "Generating fields and value lists..." },
    { icon: Layout, text: "Structuring forms and dashboards..." },
    { icon: Sparkles, text: "Finalizing Archer implementation..." }
  ];

  // Fake progress animation
  useEffect(() => {
    if (!isGenerating) return;
    
    const interval = setInterval(() => {
      setGenerationStep(prev => {
        if (prev >= STEPS.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2500); // Advance step every 2.5s
    
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setGenerationStep(0);
    
    try {
      // 1. Generate the implementation content
      const content = await generateMutation.mutateAsync({ 
        data: { prompt } 
      });
      
      // 2. Create the project record with the generated content
      // Create a sensible title from the prompt (first 5 words)
      const titleMatch = prompt.split(' ').slice(0, 5).join(' ');
      const name = titleMatch ? `${titleMatch}... App` : "New Generated App";
      
      const project = await createMutation.mutateAsync({
        data: {
          name,
          description: prompt,
          prompt: prompt,
          content: content
        }
      });
      
      toast({
        title: "Generation Complete",
        description: "Your Archer application has been designed.",
      });
      
      // Redirect to the detail page
      setLocation(`/projects/${project.id}`);
      
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "An error occurred while generating the app.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col bg-background/50 h-full overflow-hidden relative">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center z-10 min-h-0">
          
          <AnimatePresence mode="wait">
            {!isGenerating ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-3xl space-y-8"
              >
                <div className="text-center space-y-4 mb-8">
                  <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight">What do you want to build?</h1>
                  <p className="text-lg text-muted-foreground">Describe your GRC requirements, and AI will generate the complete Archer data model.</p>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <Card className="relative bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl overflow-hidden">
                    <Textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the application you want to build... e.g., 'Create a Vendor Risk Management application that tracks third-party vendors, issues risk assessments, and calculates a vendor risk score.'"
                      className="min-h-[200px] text-lg p-6 border-0 focus-visible:ring-0 resize-none bg-transparent"
                      autoFocus
                    />
                    <div className="p-4 bg-muted/30 border-t border-border/50 flex justify-between items-center">
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        ArcherPilot AI Core
                      </div>
                      <Button 
                        size="lg" 
                        onClick={handleGenerate} 
                        disabled={!prompt.trim() || isGenerating}
                        className="rounded-full px-8 shadow-lg shadow-primary/25 font-semibold"
                      >
                        Generate App
                        <Sparkles className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="space-y-4 pt-4">
                  <p className="text-sm font-medium text-muted-foreground pl-2 uppercase tracking-wider">Suggested Prompts</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setPrompt(s)}
                        className="text-left text-sm bg-secondary/50 hover:bg-secondary border border-border/50 px-4 py-3 rounded-xl transition-all hover:scale-[1.02] hover:shadow-md max-w-sm flex-1"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="generating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-xl text-center space-y-12"
              >
                <div className="relative w-32 h-32 mx-auto">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                  <motion.div 
                    className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent border-r-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  ></motion.div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Bot className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Generating Architecture</h2>
                  <p className="text-muted-foreground">Synthesizing Archer best practices with your requirements...</p>
                </div>

                <div className="bg-card border rounded-xl p-6 text-left shadow-lg space-y-4">
                  {STEPS.map((step, i) => {
                    const isActive = i === generationStep;
                    const isDone = i < generationStep;
                    const StepIcon = step.icon;
                    
                    return (
                      <div key={i} className={`flex items-center gap-4 transition-opacity duration-500 ${isDone ? 'opacity-50' : isActive ? 'opacity-100' : 'opacity-20'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDone ? 'bg-primary text-primary-foreground' : isActive ? 'bg-primary/20 text-primary animate-pulse' : 'bg-secondary text-muted-foreground'}`}>
                          {isDone ? <Sparkles className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                        </div>
                        <span className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>{step.text}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>
      </div>
    </AppLayout>
  );
}
