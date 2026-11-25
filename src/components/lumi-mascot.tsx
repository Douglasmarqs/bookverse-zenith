import { Lumi, LumiFace } from "@/components/brand/lumi";

/**
 * Compatibility wrapper: every place that shows "the mascot" now shows the
 * new Lumi. Small sizes use just her face (it reads better at icon size);
 * larger ones the whole owl. `thinking` switches to the thinking pose.
 */
export function LumiMascot({
  size = 64,
  className = "",
  thinking = false,
  interactive = false,
  onClick,
}: {
  size?: number;
  className?: string;
  thinking?: boolean;
  interactive?: boolean;
  blink?: boolean;
  onClick?: () => void;
}) {
  const art =
    size <= 44 ? (
      <LumiFace
        size={size}
        eyes={thinking ? "up" : "open"}
        className={thinking ? "animate-pulse" : ""}
      />
    ) : (
      <Lumi pose={thinking ? "thinking" : "hello"} size={size} shadow={false} bob={interactive} />
    );
  if (!onClick && !interactive) return <span className={`inline-flex ${className}`}>{art}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Lumi"
      className={`press inline-flex rounded-full transition-transform hover:-rotate-6 ${className}`}
    >
      {art}
    </button>
  );
}
