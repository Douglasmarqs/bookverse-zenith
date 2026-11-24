import { Palette } from "lucide-react";

import { AmbiencePicker } from "@/components/ambience-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ThemeSwitcher({ className = "" }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Ambiente"
        className={`press grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground ${className}`}
      >
        <Palette className="h-[18px] w-[18px]" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(92vw,22rem)] rounded-3xl border-border bg-popover/95 p-4 backdrop-blur-xl"
      >
        <p className="font-display text-2xl">Ambiente</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Muda o app inteiro. O leitor tem temas próprios.
        </p>
        <AmbiencePicker compact />
      </PopoverContent>
    </Popover>
  );
}
