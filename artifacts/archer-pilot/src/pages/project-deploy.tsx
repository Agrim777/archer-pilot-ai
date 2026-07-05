import { AppLayout } from "@/components/layout";
import { useParams, Link } from "wouter";
import { useGetProject, useGetDeployment, useStartDeployment, getGetDeploymentQueryKey, getGetProjectQueryKey, useListArcherConnections, type DeploymentStep } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Play, CheckCircle2, Circle, Loader2, AlertCircle, Server } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

export default function ProjectDeployPage() {
  const params = useParams();
  const projectId = parseInt(params.id || "0");
  const { toast } = useToast();

  const { data: project } = useGetProject(projectId, { query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } });
  const { data: connections } = useListArcherConnections();
  const startDeployment = useStartDeployment();

  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [deploymentId, setDeploymentId] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Poll deployment status if we have a running deployment
  const { data: deployment } = useGetDeployment(deploymentId as number, {
    query: {
      enabled: !!deploymentId,
      queryKey: getGetDeploymentQueryKey(deploymentId as number),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return (status === 'pending' || status === 'running') ? 1500 : false;
      }
    }
  });

  const isDeploying = deployment?.status === 'pending' || deployment?.status === 'running';
  const isComplete = deployment?.status === 'completed' || deployment?.status === 'simulated';
  const hasError = deployment?.status === 'failed';

  const handleDeploy = (simulate: boolean) => {
    if (!selectedConnection && !simulate) {
      toast({ title: "Select a connection", description: "You must select a target Archer instance.", variant: "destructive" });
      return;
    }

    setIsSimulating(simulate);
    startDeployment.mutate({
      data: {
        projectId,
        connectionId: simulate ? undefined : parseInt(selectedConnection),
        simulate
      }
    }, {
      onSuccess: (data) => {
        setDeploymentId(data.id);
        toast({ title: simulate ? "Simulation started" : "Deployment started" });
      },
      onError: (err) => {
        toast({ title: "Failed to start", description: err.message, variant: "destructive" });
      }
    });
  };

  // The predefined steps for the UI (the API might return actual steps, but we fallback to these if needed)
  const defaultSteps: DeploymentStep[] = [
    { name: "Validating Package", status: "pending", message: null },
    { name: "Creating Application", status: "pending", message: null },
    { name: "Creating Fields", status: "pending", message: null },
    { name: "Creating Value Lists", status: "pending", message: null },
    { name: "Creating Workflow", status: "pending", message: null },
    { name: "Creating Notifications", status: "pending", message: null },
  ];

  // Merge API steps with UI steps, or just use UI steps if API is lacking detail early on
  const steps = deployment?.steps?.length ? deployment.steps : defaultSteps;

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-background">
        <div className="flex-none h-16 border-b border-border/40 flex items-center px-6 shrink-0">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 -ml-2 mr-4 text-muted-foreground">
            <Link href={`/projects/${projectId}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold text-lg">Deploy Project</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            
            <div className="text-center space-y-2 mb-10">
              <h2 className="text-3xl font-bold tracking-tight">Deploy: {project?.name || "Loading..."}</h2>
              <p className="text-muted-foreground">Push this architecture directly to a target Archer instance.</p>
            </div>

            {(!deploymentId || (!isDeploying && !isComplete && !hasError)) ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <Card className="bg-card shadow-lg border-border/50">
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" /> Target Instance
                      </label>
                      <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                        <SelectTrigger className="h-12 bg-background">
                          <SelectValue placeholder="Select an Archer Connection..." />
                        </SelectTrigger>
                        <SelectContent>
                          {connections?.map(conn => (
                            <SelectItem key={conn.id} value={conn.id.toString()}>
                              {conn.name} ({conn.url})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {connections?.length === 0 && (
                        <p className="text-sm text-amber-500">No connections found. <Link href="/archer-connection" className="underline">Create one first.</Link></p>
                      )}
                    </div>

                    <div className="pt-4 flex gap-4">
                      <Button 
                        size="lg" 
                        className="flex-1 bg-primary hover:bg-primary/90 text-white h-14 text-lg shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                        onClick={() => handleDeploy(false)}
                        disabled={!selectedConnection || startDeployment.isPending}
                      >
                        <Play className="h-5 w-5 mr-2" fill="currentColor" /> Deploy Now
                      </Button>
                      <Button 
                        size="lg" 
                        variant="outline" 
                        className="flex-1 h-14 text-lg"
                        onClick={() => handleDeploy(true)}
                        disabled={startDeployment.isPending}
                      >
                        Run Simulation (Dry Run)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <Card className="bg-card shadow-xl border-primary/20 overflow-hidden relative">
                  {/* Decorative background pulse if running */}
                  {isDeploying && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20 overflow-hidden">
                      <div className="h-full bg-primary w-1/3 animate-[slide_2s_ease-in-out_infinite]" style={{ animationName: 'slide' }} />
                    </div>
                  )}

                  <CardContent className="p-10">
                    <div className="flex items-center justify-between mb-8">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-bold">
                          {isSimulating ? "Simulation Progress" : "Deployment Progress"}
                        </h3>
                        <p className="text-muted-foreground flex items-center gap-2">
                          Status: 
                          <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                            hasError ? 'bg-red-500/10 text-red-500' : 
                            isComplete ? 'bg-green-500/10 text-green-500' : 
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {deployment?.status.toUpperCase() || 'STARTING'}
                          </span>
                        </p>
                      </div>
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        {isDeploying && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
                        {isComplete && <CheckCircle2 className="h-8 w-8 text-green-500" />}
                        {hasError && <AlertCircle className="h-8 w-8 text-red-500" />}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {steps.map((step, index) => {
                        const isStepRunning = step.status === 'running';
                        const isStepComplete = step.status === 'completed';
                        const isStepFailed = step.status === 'failed';
                        const isStepPending = step.status === 'pending';

                        return (
                          <div key={index} className={`flex items-start gap-4 p-4 rounded-lg border ${
                            isStepRunning ? 'bg-primary/5 border-primary/30 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : 
                            isStepFailed ? 'bg-red-500/5 border-red-500/30' :
                            'bg-background border-border/50'
                          } transition-all duration-300`}>
                            <div className="mt-0.5 shrink-0">
                              {isStepComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                              {isStepRunning && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                              {isStepFailed && <AlertCircle className="h-5 w-5 text-red-500" />}
                              {isStepPending && <Circle className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1">
                              <h4 className={`font-medium ${
                                isStepRunning ? 'text-primary' : 
                                isStepFailed ? 'text-red-500' : 
                                isStepPending ? 'text-muted-foreground' : 'text-foreground'
                              }`}>
                                {step.name}
                              </h4>
                              {step.message && (
                                <p className="text-sm text-muted-foreground mt-1 font-mono text-xs">{step.message}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasError && (
                      <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm font-mono whitespace-pre-wrap">
                        {deployment?.error || "Unknown error occurred during deployment."}
                      </div>
                    )}

                    {(isComplete || hasError) && (
                      <div className="mt-8 flex justify-center">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setDeploymentId(null);
                            queryClient.invalidateQueries({ queryKey: getGetDeploymentQueryKey(deploymentId as number) });
                          }}
                        >
                          {hasError ? "Try Again" : "Return to Project"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

          </div>
        </div>
      </div>
      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </AppLayout>
  );
}
