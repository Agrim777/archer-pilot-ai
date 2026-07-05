import { AppLayout } from "@/components/layout";
import { Link } from "wouter";
import { useListProjects, useDeleteProject, useDuplicateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Plus, Search, MoreVertical, Pencil, Copy, Trash2, Clock, Play } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "deployed" | "archived">("all");
  const { toast } = useToast();

  const { data: projects, isLoading } = useListProjects({ 
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter 
  });

  const deleteProject = useDeleteProject();
  const duplicateProject = useDuplicateProject();

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    
    deleteProject.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Project deleted" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDuplicate = (id: number) => {
    duplicateProject.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Project duplicated" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to duplicate", description: err.message, variant: "destructive" });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'draft': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'archived': return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="flex-none p-6 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between max-w-6xl mx-auto w-full">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your generated Archer implementations</p>
            </div>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-none px-6 py-4 border-b border-border/40">
          <div className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              <Button 
                variant={statusFilter === "all" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button 
                variant={statusFilter === "draft" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("draft")}
              >
                Drafts
              </Button>
              <Button 
                variant={statusFilter === "deployed" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("deployed")}
              >
                Deployed
              </Button>
              <Button 
                variant={statusFilter === "archived" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setStatusFilter("archived")}
              >
                Archived
              </Button>
            </div>
          </div>
        </div>

        {/* Project Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto w-full">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="h-24 bg-muted/50"></CardHeader>
                    <CardContent className="py-4 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : projects?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <FolderKanban className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No projects found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  {search || statusFilter !== "all" 
                    ? "Try adjusting your filters to find what you're looking for." 
                    : "Create your first project by describing the Archer application you want to build."}
                </p>
                {(!search && statusFilter === "all") && (
                  <Button asChild className="mt-6">
                    <Link href="/projects/new">Create Project</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects?.map(project => (
                  <Card key={project.id} className="flex flex-col group hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className={`capitalize ${getStatusColor(project.status)}`}>
                          {project.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}`}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}/deploy`}>
                                <Play className="h-4 w-4 mr-2" /> Deploy
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(project.id)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(project.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardTitle className="text-xl mt-2 line-clamp-1" title={project.name}>
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="line-clamp-2 mt-1" title={project.description}>
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="py-4 flex-1">
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1"><FolderKanban className="h-3 w-3" /> Modules</span>
                          <span className="font-medium text-foreground">{project.content?.modules?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1"><FolderKanban className="h-3 w-3" /> Fields</span>
                          <span className="font-medium text-foreground">{project.content?.fields?.length || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-4 flex items-center justify-between border-t border-border/40 pt-4 mt-auto">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>
                      </div>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/projects/${project.id}`}>Open</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
