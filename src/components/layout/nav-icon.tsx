import {
  BarChart3,
  Building2,
  FilePlus2,
  FileText,
  FolderOpen,
  House,
  Inbox,
  Layers,
  ListChecks,
  ScrollText,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon as NavIconName } from "@/config/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  users: Users,
  building: Building2,
  layers: Layers,
  settings: Settings,
  audit: ScrollText,
  inbox: Inbox,
  assign: UserPlus,
  chart: BarChart3,
  queue: ListChecks,
  templates: FileText,
  requests: FileText,
  newRequest: FilePlus2,
  folder: FolderOpen,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" strokeWidth={1.75} className={className} />;
}
