import { SunMoon } from "lucide-react";

import { AmbiencePicker } from "@/components/ambience-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ThemeSwitcher({ className = "" }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Aparência"
        className={`press grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground ${className}`}
      >
        <SunMoon className="h-[18px] w-[18px]" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(92vw,20rem)] rounded-3xl border-border bg-popover p-4"
      >
        <p className="font-display text-xl">Aparência</p>
        <p className="mb-3 text-xs text-muted-foreground">
          O leitor tem seus próprios temas de página.
        </p>
        <AmbiencePicker compact />
      </PopoverContent>
    </Popover>
  );
}
