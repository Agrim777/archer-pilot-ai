import { AppLayout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListAdminUsers, useGetAdminAnalytics, useListAdminLogs } from "@workspace/api-client-react";
import { ShieldAlert, Users, Activity, Terminal, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function AdminPage() {
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetAdminAnalytics();
  const { data: users, isLoading: isLoadingUsers } = useListAdminUsers();
  const { data: logs, isLoading: isLoadingLogs } = useListAdminLogs({ limit: 50 });

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-8 space-y-8">
          
          <div className="flex items-center gap-3 border-b border-border/50 pb-6">
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Console</h1>
              <p className="text-muted-foreground mt-1">Platform-wide visibility and management.</p>
            </div>
          </div>

          <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 gap-6">
              <TabsTrigger value="analytics" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full flex items-center gap-2"><Activity className="h-4 w-4"/> Analytics</TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full flex items-center gap-2"><Users className="h-4 w-4"/> Users</TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full flex items-center gap-2"><Terminal className="h-4 w-4"/> API Logs</TabsTrigger>
            </TabsList>

            <div className="mt-8">
              <TabsContent value="analytics" className="space-y-6 focus-visible:ring-0">
                {isLoadingAnalytics ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="bg-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{analytics?.totalUsers || 0}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{analytics?.totalProjects || 0}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{analytics?.totalDeployments || 0}</div>
                        </CardContent>
                      </Card>
                    </div>
                    {/* Placeholder for charts */}
                    <Card className="h-96 flex items-center justify-center border-dashed">
                      <p className="text-muted-foreground">Chart visualizations will appear here</p>
                    </Card>
                  </>
                )}
              </TabsContent>

              <TabsContent value="users" className="focus-visible:ring-0">
                <Card>
                  <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>View and manage all registered users.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingUsers ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email / ID</TableHead>
                            <TableHead className="text-right">Projects</TableHead>
                            <TableHead className="text-right">Deployments</TableHead>
                            <TableHead className="text-right">Last Active</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users?.map(user => (
                            <TableRow key={user.userId}>
                              <TableCell className="font-medium">{user.email || user.userId}</TableCell>
                              <TableCell className="text-right">{user.projectCount}</TableCell>
                              <TableCell className="text-right">{user.deploymentCount}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {user.lastActive ? formatDistanceToNow(new Date(user.lastActive), { addSuffix: true }) : 'Never'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {users?.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="focus-visible:ring-0">
                <Card>
                  <CardHeader>
                    <CardTitle>API Traffic Logs</CardTitle>
                    <CardDescription>Recent API requests across the platform.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingLogs ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">Method</TableHead>
                              <TableHead>Endpoint</TableHead>
                              <TableHead className="w-24">Status</TableHead>
                              <TableHead className="w-24 text-right">Duration</TableHead>
                              <TableHead className="text-right">Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="font-mono text-xs">
                            {logs?.map(log => (
                              <TableRow key={log.id}>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-sm ${
                                    log.method === 'GET' ? 'bg-blue-500/10 text-blue-500' :
                                    log.method === 'POST' ? 'bg-emerald-500/10 text-emerald-500' :
                                    log.method === 'PUT' ? 'bg-amber-500/10 text-amber-500' :
                                    log.method === 'DELETE' ? 'bg-red-500/10 text-red-500' : 'bg-muted'
                                  }`}>{log.method}</span>
                                </TableCell>
                                <TableCell className="truncate max-w-[300px]">{log.endpoint}</TableCell>
                                <TableCell>
                                  <Badge variant={log.statusCode < 400 ? 'default' : 'destructive'} className="rounded-sm font-mono h-5">
                                    {log.statusCode}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">{log.durationMs}ms</TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

        </div>
      </div>
    </AppLayout>
  );
}
