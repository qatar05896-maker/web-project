import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center p-8">
      <MessageCircle className="w-16 h-16 text-muted-foreground/30" />
      <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
      <p className="text-muted-foreground text-sm">This page doesn&apos;t exist.</p>
      <Button onClick={() => setLocation("/")} variant="outline">
        Go home
      </Button>
    </div>
  );
}
