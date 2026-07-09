import { AppLayout } from "@/components/layout";
import { useParams, Link } from "wouter";
import { useGetProject, useUpdateProject, useExportProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play, Download, Save, ArrowLeft, Plus, Trash2, Edit2, Check, X,
  Database, ListTodo, FileType, GitBranch, Shield, Bell, LayoutDashboard,
  FileText, ChevronDown, ChevronRight, Layers, CheckSquare,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getGetProjectQueryKey } from "@workspace/api-client-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ── Inline-editable text ──────────────────────────────────────────────────
function InlineEdit({
  value,
  onChange,
  className,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-start gap-1">
        {multiline ? (
          <textarea
            ref={ref as any}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            className="flex-1 text-sm bg-muted border border-primary/50 rounded px-2 py-1 focus:outline-none resize-none"
          />
        ) : (
          <input
            ref={ref as any}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="flex-1 text-sm bg-muted border border-primary/50 rounded px-2 py-1 focus:outline-none"
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          />
        )}
        <button onClick={commit} className="text-green-500 hover:text-green-400 p-1"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground p-1"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className={cn("text-left w-full group flex items-start gap-1 hover:text-primary transition-colors", className)}
    >
      <span>{value || <span className="text-muted-foreground italic">click to edit</span>}</span>
      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-40 shrink-0 mt-0.5" />
    </button>
  );
}

// ── Section header ──────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, count, action }: { icon: any; title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        {count !== undefined && (
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Field type badge ────────────────────────────────────────────────────
const FIELD_TYPE_COLORS: Record<string, string> = {
  "Text": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Date": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Values List": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Cross-Reference": "bg-green-500/10 text-green-400 border-green-500/20",
  "Number": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Checkbox": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Calculated": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

function FieldTypeBadge({ type }: { type: string }) {
  const cls = FIELD_TYPE_COLORS[type] || "bg-muted text-muted-foreground border-border";
  return <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", cls)}>{type}</span>;
}

// ── Main component ──────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { toast } = useToast();
  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) }
  });
  const updateProject = useUpdateProject();
  const exportProject = useExportProject();

  const handleExport = (format: "json" | "markdown" | "archer-package") => {
    exportProject.mutate({ id, data: { format } }, {
      onSuccess: (res) => {
        const bytes = atob(res.content);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: res.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: "Export ready", description: res.filename });
      },
      onError: (err) => toast({ title: "Export failed", description: err.message, variant: "destructive" }),
    });
  };

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<any>({});
  const [contentStr, setContentStr] = useState("");
  const [expandedValueList, setExpandedValueList] = useState<number | null>(null);
  const initializedRef = useRef<number | null>(null);

  useEffect(() => {
    if (project && initializedRef.current !== id) {
      initializedRef.current = id;
      setName(project.name);
      setDescription(project.description || "");
      const c = project.content || {};
      setContent(c);
      setContentStr(JSON.stringify(c, null, 2));
    }
  }, [project, id]);

  const updateContent = (patch: any) => {
    const next = { ...content, ...patch };
    setContent(next);
    setContentStr(JSON.stringify(next, null, 2));
  };

  const handleSave = () => {
    updateProject.mutate({ id, data: { name, description, content } }, {
      onSuccess: (data) => {
        toast({ title: "Saved" });
        queryClient.setQueryData(getGetProjectQueryKey(id), data);
      },
      onError: (err) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleSaveRaw = () => {
    try {
      const parsed = JSON.parse(contentStr);
      setContent(parsed);
      updateProject.mutate({ id, data: { name, description, content: parsed } }, {
        onSuccess: (data) => {
          toast({ title: "Saved" });
          queryClient.setQueryData(getGetProjectQueryKey(id), data);
        },
      });
    } catch {
      toast({ title: "Invalid JSON", variant: "destructive" });
    }
  };

  if (isLoading || !project) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground text-sm">Loading project...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const modules: any[] = content.modules || [];
  const fields: any[] = content.fields || [];
  const valueLists: any[] = content.valueLists || [];
  const workflow: any = content.workflow || {};
  const permissions: any[] = content.recordPermissions || [];
  const reports: any[] = content.reports || [];
  const dashboards: any[] = content.dashboards || [];
  const testCases: any[] = content.testCases || [];
  const crossRefs: any[] = content.crossReferences || [];

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Top bar ── */}
        <div className="flex-none h-14 border-b border-border/40 bg-background flex items-center justify-between px-4 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0 text-muted-foreground">
              <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{project.name}</p>
              <p className="text-[11px] text-muted-foreground">{modules.length} modules · {fields.length} fields · {valueLists.length} value lists</p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{project.status}</Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={updateProject.isPending}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1.5" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("json")}>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("markdown")}>Download Build Guide (manual steps)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("archer-package")}>Export as Archer Package (experimental)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" asChild>
              <Link href={`/projects/${id}/deploy`}>
                <Play className="h-3.5 w-3.5 mr-1.5" /> Deploy to Archer
              </Link>
            </Button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 border-b border-border/40 bg-muted/10 shrink-0 overflow-x-auto">
            <TabsList className="bg-transparent border-0 h-11 justify-start gap-1 p-0 rounded-none flex-nowrap whitespace-nowrap">
              {[
                { value: "overview", label: "Overview" },
                { value: "modules", label: `Modules (${modules.length})` },
                { value: "fields", label: `Fields (${fields.length})` },
                { value: "valuelists", label: `Value Lists (${valueLists.length})` },
                { value: "workflow", label: "Workflow" },
                { value: "permissions", label: "Permissions" },
                { value: "reports", label: `Reports (${reports.length})` },
                { value: "testcases", label: `Test Cases (${testCases.length})` },
                { value: "raw", label: "Raw JSON" },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value}
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2.5 h-full text-sm">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-3xl space-y-6">
                <Card className="bg-card">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Project Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
                      <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                      <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 resize-none" rows={3} />
                    </div>
                  </CardContent>
                </Card>

                {content.businessOverview && (
                  <Card className="bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Business Overview</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{content.businessOverview}</p>
                    </CardContent>
                  </Card>
                )}

                {content.useCases?.length > 0 && (
                  <Card className="bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Use Cases</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {content.useCases.map((uc: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary font-bold mt-0.5 shrink-0">{i + 1}.</span>
                            <span className="text-muted-foreground">{uc}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Modules", count: modules.length, icon: Database },
                    { label: "Fields", count: fields.length, icon: FileType },
                    { label: "Value Lists", count: valueLists.length, icon: ListTodo },
                    { label: "Cross-Refs", count: crossRefs.length, icon: Layers },
                    { label: "Reports", count: reports.length, icon: FileText },
                    { label: "Test Cases", count: testCases.length, icon: CheckSquare },
                  ].map((s, i) => (
                    <div key={i} className="bg-card border border-border/50 rounded-lg p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <s.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold leading-none">{s.count}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── MODULES ── */}
            <TabsContent value="modules" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-3xl">
                <SectionHeader icon={Database} title="Modules" count={modules.length}
                  action={
                    <Button size="sm" variant="outline" onClick={() => updateContent({
                      modules: [...modules, { name: "New Module", description: "", type: "Standard", order: modules.length + 1 }]
                    })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Module
                    </Button>
                  }
                />
                <div className="space-y-3">
                  {modules.map((mod: any, i: number) => (
                    <Card key={i} className="bg-card border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                              <div className="flex-1 font-semibold text-sm">
                                <InlineEdit value={mod.name} onChange={v => {
                                  const next = [...modules];
                                  next[i] = { ...next[i], name: v };
                                  updateContent({ modules: next });
                                }} />
                              </div>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{mod.type || "Standard"}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground pl-7">
                              <InlineEdit multiline value={mod.description || ""} onChange={v => {
                                const next = [...modules];
                                next[i] = { ...next[i], description: v };
                                updateContent({ modules: next });
                              }} />
                            </div>
                            <div className="pl-7 text-[11px] text-muted-foreground">
                              {fields.filter((f: any) => f.module === mod.name).length} field(s) in this module
                            </div>
                          </div>
                          <button onClick={() => {
                            const next = modules.filter((_: any, j: number) => j !== i);
                            updateContent({ modules: next });
                          }} className="text-muted-foreground hover:text-red-400 p-1 shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {modules.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">No modules yet. Click Add Module to create one.</div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── FIELDS ── */}
            <TabsContent value="fields" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-4xl">
                <SectionHeader icon={FileType} title="Fields" count={fields.length}
                  action={
                    <Button size="sm" variant="outline" onClick={() => updateContent({
                      fields: [...fields, { name: "New Field", type: "Text", module: modules[0]?.name || "", required: false, description: "" }]
                    })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
                    </Button>
                  }
                />

                {/* Group by module */}
                {modules.map((mod: any, modIdx: number) => {
                  const modFields = fields.filter((f: any) => f.module === mod.name);
                  if (!modFields.length) return null;
                  return (
                    <div key={`mod-group-${modIdx}`} className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{mod.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{modFields.length} fields</Badge>
                      </div>
                      <div className="border border-border/50 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                              <th className="text-left px-4 py-2.5 font-medium">Field Name</th>
                              <th className="text-left px-4 py-2.5 font-medium">Type</th>
                              <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Description</th>
                              <th className="text-center px-4 py-2.5 font-medium">Required</th>
                              <th className="px-4 py-2.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {modFields.map((field: any, modFieldIdx: number) => {
                              const globalIdx = fields.findIndex((f: any) => f === field);
                              return (
                                <tr key={`${mod.name}-${modFieldIdx}`} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-4 py-2.5 font-medium">
                                    <InlineEdit value={field.name} onChange={v => {
                                      const next = [...fields];
                                      next[globalIdx] = { ...next[globalIdx], name: v };
                                      updateContent({ fields: next });
                                    }} />
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <select
                                      value={field.type}
                                      onChange={e => {
                                        const next = [...fields];
                                        next[globalIdx] = { ...next[globalIdx], type: e.target.value };
                                        updateContent({ fields: next });
                                      }}
                                      className="bg-transparent text-xs focus:outline-none cursor-pointer"
                                    >
                                      {["Text", "Date", "Values List", "Cross-Reference", "Number", "Checkbox", "Calculated", "IP Address", "URL"].map(t => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground text-xs max-w-xs">
                                    <InlineEdit value={field.description || ""} onChange={v => {
                                      const next = [...fields];
                                      next[globalIdx] = { ...next[globalIdx], description: v };
                                      updateContent({ fields: next });
                                    }} />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input type="checkbox" checked={!!field.required}
                                      onChange={e => {
                                        const next = [...fields];
                                        next[globalIdx] = { ...next[globalIdx], required: e.target.checked };
                                        updateContent({ fields: next });
                                      }}
                                      className="accent-primary h-3.5 w-3.5 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button onClick={() => updateContent({ fields: fields.filter((_: any, j: number) => j !== globalIdx) })}
                                      className="text-muted-foreground hover:text-red-400">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {/* Unassigned fields */}
                {(() => {
                  const unassigned = fields.filter((f: any) => !modules.some((m: any) => m.name === f.module));
                  if (!unassigned.length) return null;
                  return (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-muted-foreground">Unassigned</span>
                        <Badge variant="secondary" className="text-[10px]">{unassigned.length}</Badge>
                      </div>
                      <div className="border border-border/50 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-border/30">
                            {unassigned.map((field: any) => {
                              const gi = fields.findIndex((f: any) => f === field);
                              return (
                                <tr key={gi} className="hover:bg-muted/20">
                                  <td className="px-4 py-2.5 font-medium">
                                    <InlineEdit value={field.name} onChange={v => {
                                      const next = [...fields]; next[gi] = { ...next[gi], name: v };
                                      updateContent({ fields: next });
                                    }} />
                                  </td>
                                  <td className="px-4 py-2.5 text-xs"><FieldTypeBadge type={field.type} /></td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button onClick={() => updateContent({ fields: fields.filter((_: any, j: number) => j !== gi) })}
                                      className="text-muted-foreground hover:text-red-400">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {fields.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">No fields yet.</div>
                )}
              </div>
            </TabsContent>

            {/* ── VALUE LISTS ── */}
            <TabsContent value="valuelists" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-3xl">
                <SectionHeader icon={ListTodo} title="Value Lists" count={valueLists.length}
                  action={
                    <Button size="sm" variant="outline" onClick={() => updateContent({
                      valueLists: [...valueLists, { name: "New List", description: "", values: ["Option 1", "Option 2"] }]
                    })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add List
                    </Button>
                  }
                />
                <div className="space-y-3">
                  {valueLists.map((vl: any, i: number) => (
                    <Card key={i} className="bg-card border-border/60">
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors rounded-t-lg cursor-pointer"
                        onClick={() => setExpandedValueList(expandedValueList === i ? null : i)}
                        onKeyDown={e => e.key === "Enter" && setExpandedValueList(expandedValueList === i ? null : i)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedValueList === i ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium text-sm">{vl.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{vl.values?.length || 0} values</Badge>
                        </div>
                        <button onClick={e => { e.stopPropagation(); updateContent({ valueLists: valueLists.filter((_: any, j: number) => j !== i) }); }}
                          className="text-muted-foreground hover:text-red-400 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {expandedValueList === i && (
                        <CardContent className="pt-0 pb-4 px-4 border-t border-border/30">
                          <div className="pl-7 space-y-3 pt-3">
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">List Name</label>
                              <div className="mt-1">
                                <InlineEdit value={vl.name} onChange={v => {
                                  const next = [...valueLists]; next[i] = { ...next[i], name: v };
                                  updateContent({ valueLists: next });
                                }} className="font-medium" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                              <div className="mt-1 text-sm text-muted-foreground">
                                <InlineEdit multiline value={vl.description || ""} onChange={v => {
                                  const next = [...valueLists]; next[i] = { ...next[i], description: v };
                                  updateContent({ valueLists: next });
                                }} />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Values</label>
                              <div className="flex flex-wrap gap-2">
                                {(vl.values || []).map((val: string, vi: number) => (
                                  <div key={vi} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-xs group">
                                    <InlineEdit value={val} onChange={v => {
                                      const next = [...valueLists];
                                      const vals = [...(next[i].values || [])];
                                      vals[vi] = v;
                                      next[i] = { ...next[i], values: vals };
                                      updateContent({ valueLists: next });
                                    }} />
                                    <button onClick={() => {
                                      const next = [...valueLists];
                                      next[i] = { ...next[i], values: vl.values.filter((_: any, vj: number) => vj !== vi) };
                                      updateContent({ valueLists: next });
                                    }} className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 ml-1">
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                ))}
                                <button onClick={() => {
                                  const next = [...valueLists];
                                  next[i] = { ...next[i], values: [...(vl.values || []), "New Value"] };
                                  updateContent({ valueLists: next });
                                }} className="flex items-center gap-1 border border-dashed border-border px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                                  <Plus className="h-2.5 w-2.5" /> Add Value
                                </button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                  {valueLists.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">No value lists.</div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── WORKFLOW ── */}
            <TabsContent value="workflow" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-3xl space-y-6">
                <SectionHeader icon={GitBranch} title="Workflow" />

                {workflow.name && (
                  <Card className="bg-card">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Workflow Name</p>
                      <p className="font-semibold">{workflow.name}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Stages */}
                {workflow.stages?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      Stages <Badge variant="secondary" className="text-[10px]">{workflow.stages.length}</Badge>
                    </p>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {workflow.stages.map((stage: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 shrink-0">
                          <div className="bg-card border border-border/60 rounded-lg px-4 py-3 text-center min-w-[120px]">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-2">
                              <span className="text-xs font-bold text-primary">{i + 1}</span>
                            </div>
                            <p className="text-xs font-semibold">{stage.name}</p>
                            {stage.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{stage.description}</p>}
                            {stage.nodeType && <Badge variant="secondary" className="text-[9px] mt-1">{stage.nodeType}</Badge>}
                          </div>
                          {i < workflow.stages.length - 1 && <span className="text-muted-foreground text-lg shrink-0">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transitions */}
                {workflow.transitions?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      Transitions <Badge variant="secondary" className="text-[10px]">{workflow.transitions.length}</Badge>
                    </p>
                    <div className="border border-border/50 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium">From</th>
                            <th className="text-left px-4 py-2.5 font-medium">Action</th>
                            <th className="text-left px-4 py-2.5 font-medium">To</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {workflow.transitions.map((tr: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{tr.from}</Badge></td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{tr.action}</td>
                              <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px] border-primary/40 text-primary/80">{tr.to}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Notifications */}
                {workflow.notifications?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" /> Notifications
                    </p>
                    <ul className="space-y-1.5">
                      {workflow.notifications.map((n: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary mt-0.5">•</span> {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── PERMISSIONS ── */}
            <TabsContent value="permissions" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-3xl">
                <SectionHeader icon={Shield} title="Record Permissions" count={permissions.length}
                  action={
                    <Button size="sm" variant="outline" onClick={() => updateContent({
                      recordPermissions: [...permissions, { group: "New Group", read: true, create: false, update: false, delete: false }]
                    })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Group
                    </Button>
                  }
                />
                <div className="border border-border/50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Group / Role</th>
                        {["Read", "Create", "Update", "Delete"].map(p => (
                          <th key={p} className="text-center px-4 py-3 font-medium">{p}</th>
                        ))}
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {permissions.map((perm: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">
                            <InlineEdit value={perm.group} onChange={v => {
                              const next = [...permissions]; next[i] = { ...next[i], group: v };
                              updateContent({ recordPermissions: next });
                            }} />
                          </td>
                          {(["read", "create", "update", "delete"] as const).map(p => (
                            <td key={p} className="px-4 py-3 text-center">
                              <input type="checkbox" checked={!!perm[p]}
                                onChange={e => {
                                  const next = [...permissions]; next[i] = { ...next[i], [p]: e.target.checked };
                                  updateContent({ recordPermissions: next });
                                }}
                                className="accent-primary h-4 w-4 cursor-pointer"
                              />
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => updateContent({ recordPermissions: permissions.filter((_: any, j: number) => j !== i) })}
                              className="text-muted-foreground hover:text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {permissions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">No permissions defined.</div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── REPORTS ── */}
            <TabsContent value="reports" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-3xl space-y-8">
                {reports.length > 0 && (
                  <div>
                    <SectionHeader icon={FileText} title="Reports" count={reports.length} />
                    <div className="space-y-3">
                      {reports.map((r: any, i: number) => (
                        <Card key={i} className="bg-card border-border/60">
                          <CardContent className="p-4 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-sm">{r.name}</p>
                              <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{r.description}</p>
                            {r.fields?.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {r.fields.map((f: string, fi: number) => (
                                  <span key={fi} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{f}</span>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {dashboards.length > 0 && (
                  <div>
                    <SectionHeader icon={LayoutDashboard} title="Dashboards" count={dashboards.length} />
                    <div className="space-y-3">
                      {dashboards.map((d: any, i: number) => (
                        <Card key={i} className="bg-card border-border/60">
                          <CardContent className="p-4 space-y-2">
                            <p className="font-semibold text-sm">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.description}</p>
                            {d.charts?.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {d.charts.map((c: any, ci: number) => (
                                  <div key={ci} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/20">
                                    {c.type}: {c.title}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {reports.length === 0 && dashboards.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">No reports or dashboards.</div>
                )}
              </div>
            </TabsContent>

            {/* ── TEST CASES ── */}
            <TabsContent value="testcases" className="p-6 m-0 border-0 focus-visible:ring-0">
              <div className="max-w-3xl">
                <SectionHeader icon={CheckSquare} title="Test Cases" count={testCases.length} />
                <div className="space-y-3">
                  {testCases.map((tc: any, i: number) => (
                    <Card key={i} className="bg-card border-border/60">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground">{tc.id || `TC-${i + 1}`}</span>
                              <p className="font-semibold text-sm">{tc.name}</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Steps</p>
                          <ol className="space-y-1">
                            {(tc.steps || []).map((step: string, si: number) => (
                              <li key={si} className="text-xs text-muted-foreground flex gap-2">
                                <span className="text-primary font-bold shrink-0">{si + 1}.</span>{step}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div className="bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2">
                          <p className="text-[10px] font-medium text-green-400 uppercase tracking-wider mb-0.5">Expected Result</p>
                          <p className="text-xs text-muted-foreground">{tc.expectedResult}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {testCases.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">No test cases.</div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── RAW JSON ── */}
            <TabsContent value="raw" className="p-0 m-0 h-full border-0 focus-visible:ring-0 flex flex-col" style={{ minHeight: "60vh" }}>
              <div className="bg-muted text-xs p-2 px-4 border-b border-border text-muted-foreground flex items-center justify-between shrink-0">
                <span className="font-mono">content.json — edit raw JSON, then click Save</span>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleSaveRaw}>Save JSON</Button>
              </div>
              <textarea
                value={contentStr}
                onChange={e => setContentStr(e.target.value)}
                className="flex-1 w-full bg-[#0d0d0f] text-zinc-300 font-mono text-xs p-4 border-0 focus:ring-0 resize-none"
                spellCheck={false}
                style={{ minHeight: "60vh" }}
              />
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
