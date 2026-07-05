import { AppLayout } from "@/components/layout";
import { useParams, Link } from "wouter";
import { useGetProject, useUpdateProject, useGetDashboardStats } from "@workspace/api-client-react"; // Need a real export endpoint eventually, pretending for now
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, Download, History, Save, ArrowLeft,
  Database, ListTodo, FileType, CheckSquare, 
  Users, Bell, LayoutDashboard, FileText
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getGetProjectQueryKey } from "@workspace/api-client-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { toast } = useToast();

  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) }
  });
  
  const updateProject = useUpdateProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contentStr, setContentStr] = useState(""); // Simplified generic string edit for the JSON for now
  
  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (project && initializedForId.current !== id) {
      initializedForId.current = id;
      setName(project.name);
      setDescription(project.description || "");
      setContentStr(JSON.stringify(project.content, null, 2));
    }
  }, [project, id]);

  const handleSave = () => {
    try {
      const parsedContent = JSON.parse(contentStr);
      updateProject.mutate({
        id,
        data: {
          name,
          description,
          content: parsedContent
        }
      }, {
        onSuccess: (data) => {
          toast({ title: "Project saved" });
          queryClient.setQueryData(getGetProjectQueryKey(id), data);
        },
        onError: (err) => {
          toast({ title: "Failed to save", description: err.message, variant: "destructive" });
        }
      });
    } catch (e) {
      toast({ title: "Invalid JSON", description: "The content must be valid JSON.", variant: "destructive" });
    }
  };

  if (isLoading || !project) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse space-y-4 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <p className="text-muted-foreground">Loading project...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Very basic overview stats from the JSON structure
  const content = project.content || {};
  const stats = [
    { label: "Modules", count: content.modules?.length || 0, icon: Database },
    { label: "Fields", count: content.fields?.length || 0, icon: FileType },
    { label: "Value Lists", count: content.valueLists?.length || 0, icon: ListTodo },
    { label: "Cross-Refs", count: content.crossReferences?.length || 0, icon: Database },
    { label: "Dashboards", count: content.dashboards?.length || 0, icon: LayoutDashboard },
    { label: "Reports", count: content.reports?.length || 0, icon: FileText },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header Bar */}
        <div className="flex-none h-16 border-b border-border/40 bg-background flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground">
              <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-sm line-clamp-1">{project.name}</h1>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium uppercase tracking-wider">{project.status}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={updateProject.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save Draft
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem>Export as Markdown Spec</DropdownMenuItem>
                <DropdownMenuItem>Export as Archer Package (.zip)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href={`/projects/${id}/deploy`}>
                <Play className="h-4 w-4 mr-2" /> Deploy to Archer
              </Link>
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Editor/Tabs */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <Tabs defaultValue="overview" className="flex-1 flex flex-col">
              <div className="px-6 border-b border-border/40 bg-muted/10 shrink-0">
                <TabsList className="bg-transparent border-0 h-12 w-full justify-start gap-6 p-0 rounded-none">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full">Overview</TabsTrigger>
                  <TabsTrigger value="schema" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full">Schema Editor</TabsTrigger>
                  <TabsTrigger value="prompt" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full">Original Prompt</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="overview" className="p-6 m-0 h-full border-0 focus-visible:ring-0">
                  <div className="max-w-4xl space-y-8">
                    
                    {/* Basic Meta */}
                    <Card className="bg-card shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg">Project Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Project Name</label>
                          <Input value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Description</label>
                          <Textarea value={description} onChange={e => setDescription(e.target.value)} className="resize-none" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Architecture Summary */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold tracking-tight">Generated Architecture Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {stats.map((stat, i) => (
                          <div key={i} className="bg-card border border-border/50 rounded-lg p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <stat.icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="text-2xl font-bold leading-none">{stat.count}</div>
                              <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">{stat.label}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </TabsContent>

                <TabsContent value="schema" className="p-0 m-0 h-full border-0 focus-visible:ring-0 flex flex-col">
                  <div className="bg-muted text-xs p-2 px-4 border-b border-border text-muted-foreground flex justify-between items-center shrink-0">
                    <span>content.json</span>
                    <Badge variant="outline" className="font-mono text-[10px]">RAW JSON</Badge>
                  </div>
                  <textarea 
                    value={contentStr}
                    onChange={e => setContentStr(e.target.value)}
                    className="flex-1 w-full bg-[#0d0d0f] text-zinc-300 font-mono text-sm p-4 border-0 focus:ring-0 resize-none"
                    spellCheck={false}
                  />
                </TabsContent>

                <TabsContent value="prompt" className="p-6 m-0 h-full border-0 focus-visible:ring-0">
                  <Card className="max-w-4xl bg-card shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Original Generation Prompt</CardTitle>
                      <CardDescription>The instructions used by the AI to build this application.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 border border-border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-foreground">
                        {project.prompt || "No prompt recorded."}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Right Panel: Version History / AI Tools */}
          <div className="w-80 border-l border-border/40 bg-card/30 flex flex-col shrink-0 hidden lg:flex">
             <div className="p-4 border-b border-border/40 shrink-0">
               <h3 className="font-semibold text-sm flex items-center gap-2">
                 <History className="h-4 w-4 text-muted-foreground" />
                 Version History
               </h3>
             </div>
             <ScrollArea className="flex-1">
               <div className="p-4 space-y-4">
                 {/* Mock history since we don't have the hook data loaded visually */}
                 <div className="relative pl-4 border-l-2 border-primary/30 pb-4">
                   <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-primary" />
                   <p className="text-sm font-medium">Current Draft</p>
                   <p className="text-xs text-muted-foreground mt-1">Edited just now</p>
                 </div>
                 <div className="relative pl-4 border-l-2 border-border pb-4">
                   <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-muted-foreground" />
                   <p className="text-sm font-medium">Initial AI Generation</p>
                   <p className="text-xs text-muted-foreground mt-1">Created via Prompt</p>
                 </div>
               </div>
             </ScrollArea>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
