import {
  Building2,
  ChartColumn,
  CircleHelp,
  ClipboardList,
  FilePlus2,
  FileStack,
  House,
  Inbox,
  Layers,
  ListChecks,
  ScrollText,
  Settings,
  UserRoundCheck,
  UserRoundPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon as NavIconName } from "@/config/nav";

// One icon per concept across the platform (D-095): requests are always Inbox, templates and
// documents FileStack, assignment UserRoundCheck, adding a user UserRoundPlus.
const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  users: UsersRound,
  addUser: UserRoundPlus,
  registrations: ClipboardList,
  building: Building2,
  layers: Layers,
  settings: Settings,
  audit: ScrollText,
  inbox: Inbox,
  assign: UserRoundCheck,
  chart: ChartColumn,
  queue: ListChecks,
  templates: FileStack,
  requests: Inbox,
  newRequest: FilePlus2,
  folder: FileStack,
  help: CircleHelp,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" strokeWidth={1.75} className={className} />;
}
