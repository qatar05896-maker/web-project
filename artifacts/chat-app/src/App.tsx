import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { SocketProvider } from "@/components/SocketProvider";
import { AuthProvider } from "@/lib/auth-context";
import AuthPage from "@/pages/auth";
import ChatList from "@/pages/chat-list";
import ChatDetail from "@/pages/chat";
import NewChat from "@/pages/new-chat";
import Settings from "@/pages/settings";
import GroupDetail from "@/pages/group";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/" component={ChatList} />
      <Route path="/chat/:chatId" component={ChatDetail} />
      <Route path="/new-chat" component={NewChat} />
      <Route path="/settings" component={Settings} />
      <Route path="/group/:chatId" component={GroupDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <SocketProvider>
              <Router />
            </SocketProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
