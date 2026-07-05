import { AppLayout } from "@/components/layout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Activity, Clock, Play, Plus, ArrowRight, Zap, FileText } from "lucide-react";
import { useGetDashboardStats } from "@workspace/api-client-react";

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Overview of your Archer implementations</p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-[0_0_15px_rgba(79,70,229,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{isLoading ? "..." : stats?.totalProjects || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.draftProjects || 0} drafts, {stats?.deployedProjects || 0} deployed
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur-sm border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Deployments</CardTitle>
                <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{isLoading ? "..." : stats?.totalDeployments || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Lifetime successful deployments</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Hours Saved</CardTitle>
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-500">{isLoading ? "..." : stats?.savedHours || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Estimated manual work avoided</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-7">
            <Card className="md:col-span-4 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Start
                </CardTitle>
                <CardDescription>Generate a new Archer implementation instantly.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <textarea 
                      className="w-full min-h-[120px] bg-background border rounded-lg p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
                      placeholder="Describe the application you want to build... e.g., 'Create a Vendor Risk Management application that tracks third-party vendors, issues risk assessments, and calculates a vendor risk score based on answers.'"
                    ></textarea>
                    <div className="absolute bottom-4 right-4">
                      <Button size="sm" className="gap-2">
                        <Play className="h-3 w-3" />
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-muted-foreground py-1">Examples:</span>
                    <button className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md transition-colors border border-border/50">
                      IT Exception Management
                    </button>
                    <button className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md transition-colors border border-border/50">
                      Policy Exception Tracker
                    </button>
                    <button className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md transition-colors border border-border/50">
                      Business Continuity Plan
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3 bg-card/50 backdrop-blur-sm flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Activity</span>
                  <Link href="/projects" className="text-xs text-primary font-normal flex items-center gap-1 hover:underline">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-secondary"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-secondary rounded w-3/4"></div>
                          <div className="h-2 bg-secondary rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : stats?.recentActivity?.length ? (
                  <div className="space-y-6">
                    {stats.recentActivity.map((activity, i) => (
                      <div key={activity.id} className="flex gap-3 relative">
                        {i !== stats.recentActivity.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-[-24px] w-[1px] bg-border"></div>
                        )}
                        <div className="w-8 h-8 rounded-full bg-secondary border flex items-center justify-center shrink-0 z-10">
                          {activity.type === 'deployment' ? (
                            <Activity className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No activity yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Your recent generations and deployments will appear here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
