import { AppLayout } from "@/components/layout";
import { useListArcherConnections, useCreateArcherConnection, useDeleteArcherConnection, useTestArcherConnection, getListArcherConnectionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Server, Plus, Trash2, Activity, Network, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function ArcherConnectionPage() {
  const { data: connections, isLoading } = useListArcherConnections();
  const createConnection = useCreateArcherConnection();
  const deleteConnection = useDeleteArcherConnection();
  const testConnection = useTestArcherConnection();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState("");
  const [tenantName, setTenantName] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createConnection.mutate({
      data: { name, url, username, credential, tenantName: tenantName || undefined }
    }, {
      onSuccess: () => {
        toast({ title: "Connection Added" });
        setIsAdding(false);
        setName(""); setUrl(""); setUsername(""); setCredential(""); setTenantName("");
        queryClient.invalidateQueries({ queryKey: getListArcherConnectionsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to add connection", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this connection?")) return;
    deleteConnection.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Connection Deleted" });
        queryClient.invalidateQueries({ queryKey: getListArcherConnectionsQueryKey() });
      }
    });
  };

  const handleTest = (id: number) => {
    setTestingId(id);
    testConnection.mutate({ id }, {
      onSuccess: (res) => {
        setTestingId(null);
        if (res.success) {
          toast({ 
            title: "Connection Successful", 
            description: "Successfully communicated with the Archer API.",
            className: "bg-emerald-500 text-white border-emerald-600"
          });
        } else {
          toast({ 
            title: "Connection Failed", 
            description: res.message, 
            variant: "destructive" 
          });
        }
      },
      onError: (err) => {
        setTestingId(null);
        toast({ title: "Test Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-8 bg-background">
        <div className="max-w-5xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between border-b border-border/50 pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Archer Connections</h1>
              <p className="text-muted-foreground mt-1">Manage target RSA Archer instances for deployment.</p>
            </div>
            {!isAdding && (
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Connection
              </Button>
            )}
          </div>

          {isAdding && (
            <Card className="bg-card border-primary/20 shadow-[0_0_20px_rgba(79,70,229,0.1)]">
              <CardHeader>
                <CardTitle>New Connection</CardTitle>
                <CardDescription>Enter the details for the target Archer API.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreate}>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Display Name</label>
                      <Input value={name} onChange={e=>setName(e.target.value)} required placeholder="e.g. Prod Instance" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Instance URL</label>
                      <Input value={url} onChange={e=>setUrl(e.target.value)} required placeholder="https://archer.company.com" type="url" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Username</label>
                      <Input value={username} onChange={e=>setUsername(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password / API Token</label>
                      <Input value={credential} onChange={e=>setCredential(e.target.value)} required type="password" />
                    </div>
                  </div>
                  <div className="space-y-2 w-1/2 pr-2">
                    <label className="text-sm font-medium">Tenant Name (Optional)</label>
                    <Input value={tenantName} onChange={e=>setTenantName(e.target.value)} placeholder="Required for multi-tenant SaaS" />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 bg-muted/20 border-t border-border/50 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button type="submit" disabled={createConnection.isPending}>
                    {createConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Connection"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              <div className="col-span-2 text-center py-12 text-muted-foreground flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin mb-4" /> Loading connections...
              </div>
            ) : connections?.length === 0 ? (
              <div className="col-span-2 text-center py-20 bg-card border rounded-lg">
                <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold">No connections</h3>
                <p className="text-muted-foreground">Add a connection to deploy your applications.</p>
              </div>
            ) : (
              connections?.map(conn => (
                <Card key={conn.id} className="flex flex-col relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${conn.isActive ? 'bg-emerald-500' : 'bg-zinc-500'}`}></div>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Network className="h-5 w-5 text-primary" />
                        <CardTitle className="text-xl">{conn.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(conn.id)}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                    </div>
                    <CardDescription className="font-mono text-xs mt-2 truncate bg-muted/50 p-1.5 rounded">{conn.url}</CardDescription>
                  </CardHeader>
                  <CardContent className="py-2 flex-1">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div className="text-muted-foreground">Username:</div>
                      <div className="font-medium">{conn.username}</div>
                      {conn.tenantName && (
                        <>
                          <div className="text-muted-foreground">Tenant:</div>
                          <div className="font-medium">{conn.tenantName}</div>
                        </>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/40 mt-4 bg-muted/10">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => handleTest(conn.id)}
                      disabled={testingId === conn.id}
                    >
                      {testingId === conn.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</>
                      ) : (
                        <><Activity className="h-4 w-4 mr-2" /> Test Connection</>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
