import { Link } from "react-router-dom";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-signal-50 text-signal">
        <Radar className="h-5 w-5" />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Nothing on the radar</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          This page doesn't exist, or may have moved.
        </p>
      </div>
      <Link to="/">
        <Button variant="secondary">Back to overview</Button>
      </Link>
    </div>
  );
}
