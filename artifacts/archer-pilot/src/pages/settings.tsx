import { AppLayout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserProfile } from "@clerk/react";
import { Key, Moon, Sun, Building, ExternalLink } from "lucide-react";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-8 space-y-8">
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account and platform preferences.</p>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 gap-6">
              <TabsTrigger value="general" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full">General</TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full">AI Configuration</TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 h-full">Profile</TabsTrigger>
            </TabsList>

            <div className="mt-8">
              <TabsContent value="general" className="space-y-6 focus-visible:ring-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Moon className="h-5 w-5" /> Appearance</CardTitle>
                    <CardDescription>Customize the look and feel of the platform.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Dark Mode</Label>
                        <p className="text-sm text-muted-foreground">Toggle between light and dark themes.</p>
                      </div>
                      <Switch 
                        checked={theme === 'dark'} 
                        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> Organization</CardTitle>
                    <CardDescription>Manage your workspace details.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Workspace Name</Label>
                      <Input defaultValue="Consulting Team Alpha" />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                    <Button>Save Changes</Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="ai" className="space-y-6 focus-visible:ring-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> API Keys</CardTitle>
                    <CardDescription>Provide your own API keys to increase rate limits.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Google Gemini API Key</Label>
                      <Input type="password" placeholder="AIzaSy..." defaultValue="sk-dummy-key-for-ui" />
                      <p className="text-xs text-muted-foreground mt-2">
                        Used for the generation engine and Copilot. <a href="#" className="text-primary hover:underline">Get an API key</a>
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                    <Button>Update Key</Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="profile" className="focus-visible:ring-0">
                {/* Embedded Clerk Profile */}
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex justify-center py-8">
                  <UserProfile 
                    appearance={{
                      elements: {
                        rootBox: "w-full max-w-3xl",
                        cardBox: "shadow-none border-0 w-full",
                      }
                    }}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

        </div>
      </div>
    </AppLayout>
  );
}
