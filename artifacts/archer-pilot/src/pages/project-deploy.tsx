import { AppLayout } from "@/components/layout";
import { useParams, Link } from "wouter";
import {
  useGetProject, useGetDeployment, useStartDeployment,
  getGetDeploymentQueryKey, getGetProjectQueryKey,
  useListArcherConnections, type DeploymentStep
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Play, CheckCircle2, Circle, Loader2,
  AlertCircle, Server, AlertTriangle, FlaskConical
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";

export default function ProjectDeployPage() {
  const params = useParams();
  const projectId = parseInt(params.id || "0");
  const { toast } = useToast();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });
  const { data: connections } = useListArcherConnections();
  const startDeployment = useStartDeployment();

  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [deploymentId, setDeploymentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"real" | "dry" | null>(null);

  const { data: deployment } = useGetDeployment(deploymentId as number, {
    query: {
      enabled: !!deploymentId,
      queryKey: getGetDeploymentQueryKey(deploymentId as number),
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return (s === "pending" || s === "running") ? 1500 : false;
      }
    }
  });

  const isDeploying = deployment?.status === "pending" || deployment?.status === "running";
  const isComplete  = deployment?.status === "completed" || deployment?.status === "simulated";
  const hasError    = deployment?.status === "failed";

  const handleDeploy = (simulate: boolean) => {
    if (!selectedConnection && !simulate) {
      toast({ title: "Select a connection", description: "Choose the Archer instance to deploy to.", variant: "destructive" });
      return;
    }
    setMode(simulate ? "dry" : "real");
    startDeployment.mutate({
      data: {
        projectId,
        connectionId: simulate ? undefined : parseInt(selectedConnection),
        simulate,
      }
    }, {
      onSuccess: (data) => {
        setDeploymentId(data.id);
        toast({ title: simulate ? "Dry run started" : "Deployment started — creating in Archer" });
      },
      onError: (err) => {
        toast({ title: "Failed to start", description: err.message, variant: "destructive" });
      }
    });
  };

  const defaultSteps: DeploymentStep[] = [
    { name: "Login",                    status: "pending", message: null },
    { name: "Creating Application",     status: "pending", message: null },
    { name: "Creating Modules",         status: "pending", message: null },
    { name: "Creating Value Lists",     status: "pending", message: null },
    { name: "Creating Fields",          status: "pending", message: null },
    { name: "Creating Cross References",status: "pending", message: null },
    { name: "Creating Workflow",        status: "pending", message: null },
    { name: "Creating Record Permissions",status:"pending",message: null },
    { name: "Creating Notifications",   status: "pending", message: null },
    { name: "Finalizing Deployment",    status: "pending", message: null },
  ];

  const steps = deployment?.steps?.length ? deployment.steps : defaultSteps;
  const hasWarnings = deployment?.error && (deployment.status === "completed" || deployment.status === "simulated");

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-background">

        {/* Header */}
        <div className="flex-none h-14 border-b border-border/40 flex items-center px-6 shrink-0 gap-4">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 -ml-2 text-muted-foreground">
            <Link href={`/projects/${projectId}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="font-semibold text-sm">Deploy to Archer</h1>
            <p className="text-[11px] text-muted-foreground">{project?.name}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Setup card — shown before any deployment starts */}
            {!deploymentId && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-card border-border/60">
                  <CardContent className="p-6 space-y-5">

                    {/* Connection picker */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        Target Archer Instance
                      </label>
                      <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                        <SelectTrigger className="h-11 bg-background">
                          <SelectValue placeholder="Select an Archer Connection…" />
                        </SelectTrigger>
                        <SelectContent>
                          {connections?.map(conn => (
                            <SelectItem key={conn.id} value={conn.id.toString()}>
                              <span className="font-medium">{conn.name}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{conn.url}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {connections?.length === 0 && (
                        <p className="text-xs text-amber-400">
                          No connections yet.{" "}
                          <Link href="/archer-connection" className="underline">Add one first →</Link>
                        </p>
                      )}
                    </div>

                    {/* Safety note */}
                    <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-300 space-y-1">
                      <p className="font-semibold">What this does</p>
                      <ul className="text-xs text-blue-300/80 space-y-0.5 list-disc list-inside">
                        <li>Creates a <strong>brand-new</strong> application in Archer with all modules, fields, value lists, and notifications</li>
                        <li>Never modifies or deletes anything that already exists</li>
                        <li>Appears in Archer exactly like a manually built application — no trace of AI</li>
                      </ul>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-1">
                      <Button
                        size="lg"
                        className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white"
                        onClick={() => handleDeploy(false)}
                        disabled={!selectedConnection || startDeployment.isPending}
                      >
                        <Play className="h-4 w-4 mr-2" fill="currentColor" />
                        Create in Archer
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-12 px-5"
                        onClick={() => handleDeploy(true)}
                        disabled={startDeployment.isPending}
                        title="Test the flow without touching Archer"
                      >
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Dry Run
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Progress card — shown while running or after completion */}
            {deploymentId && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className={`border overflow-hidden ${
                  hasError ? "border-red-500/30" : isComplete ? "border-green-500/20" : "border-primary/20"
                }`}>
                  {/* Top progress bar while running */}
                  {isDeploying && (
                    <div className="h-0.5 bg-primary/20 overflow-hidden">
                      <div className="h-full bg-primary w-1/3 animate-[slide_2s_ease-in-out_infinite]" />
                    </div>
                  )}

                  <CardContent className="p-6">
                    {/* Status header */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-bold text-lg">
                          {mode === "dry" ? "Dry Run" : "Creating in Archer"}
                        </h3>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                          hasError    ? "bg-red-500/10 text-red-400" :
                          isComplete  ? "bg-green-500/10 text-green-400" :
                                        "bg-blue-500/10 text-blue-400"
                        }`}>
                          {deployment?.status?.toUpperCase() ?? "STARTING"}
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        {isDeploying && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
                        {isComplete  && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                        {hasError    && <AlertCircle className="h-6 w-6 text-red-500" />}
                      </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-2">
                      {steps.map((step, i) => {
                        const isRunning  = step.status === "running";
                        const isDone     = step.status === "completed";
                        const isFailed   = step.status === "failed";
                        const isWarning  = step.status === "warning";
                        const isPending  = step.status === "pending";

                        return (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                            isRunning ? "bg-primary/8 border border-primary/25" :
                            isFailed  ? "bg-red-500/8 border border-red-500/25" :
                            isWarning ? "bg-amber-500/8 border border-amber-500/20" :
                            isDone    ? "bg-muted/30 border border-transparent" :
                                        "border border-transparent opacity-50"
                          }`}>
                            <div className="mt-0.5 shrink-0">
                              {isDone    && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                              {isRunning && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                              {isFailed  && <AlertCircle className="h-4 w-4 text-red-500" />}
                              {isWarning && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                              {isPending && <Circle className="h-4 w-4 text-muted-foreground/40" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${
                                isRunning ? "text-primary" :
                                isFailed  ? "text-red-400" :
                                isWarning ? "text-amber-400" :
                                isPending ? "text-muted-foreground/50" : ""
                              }`}>
                                {step.name}
                              </p>
                              {step.message && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                                  {step.message}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Error box */}
                    {hasError && deployment?.error && !hasWarnings && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs font-mono text-red-400 whitespace-pre-wrap break-words">
                          {deployment.error}
                        </p>
                      </div>
                    )}

                    {/* Warnings (partial success) */}
                    {hasWarnings && (
                      <div className="mt-4 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                        <p className="text-xs font-semibold text-amber-400 mb-1">Deployment completed with warnings</p>
                        <p className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words">
                          {deployment?.error}
                        </p>
                      </div>
                    )}

                    {/* Success message */}
                    {isComplete && !hasError && (
                      <div className="mt-4 p-3 bg-green-500/8 border border-green-500/20 rounded-lg">
                        <p className="text-sm text-green-400 font-medium">
                          {mode === "dry"
                            ? "Dry run complete — no changes made to Archer."
                            : "Application created in Archer. Open your Archer portal to see it."}
                        </p>
                      </div>
                    )}

                    {/* Bottom actions */}
                    {(isComplete || hasError) && (
                      <div className="mt-5 flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeploymentId(null);
                            setMode(null);
                            queryClient.invalidateQueries({ queryKey: getGetDeploymentQueryKey(deploymentId as number) });
                          }}
                        >
                          {hasError ? "Try Again" : "Deploy Again"}
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/projects/${projectId}`}>Back to Project</Link>
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
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </AppLayout>
  );
}
