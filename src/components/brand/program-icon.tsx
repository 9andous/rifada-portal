import { BookMarked, BookOpen, BookOpenText, GraduationCap, HandHeart, Layers, MessageCircleQuestion, Mic, type LucideIcon } from "lucide-react";

/** Icon for each of the Presidency's seven programmes, by programme number. */
const PROGRAM_ICONS: Record<number, LucideIcon> = {
  1: Mic,
  2: BookOpen,
  3: BookMarked,
  4: MessageCircleQuestion,
  5: BookOpenText,
  6: HandHeart,
  7: GraduationCap,
};

export function ProgramIcon({ number, className }: { number: number; className?: string }) {
  const Icon = PROGRAM_ICONS[number] ?? Layers;
  return <Icon aria-hidden="true" strokeWidth={1.75} className={className} />;
}
