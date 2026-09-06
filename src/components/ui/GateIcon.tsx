import {
  AlertTriangle,
  Eye,
  GitPullRequest,
  Terminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  AlertTriangle,
  Eye,
  GitPullRequest,
  Terminal,
  Wrench,
};

export function GateIcon({ name }: { name?: string }) {
  const Icon = icons[name || "Terminal"] || Terminal;
  return <Icon size={15} aria-hidden="true" />;
}
