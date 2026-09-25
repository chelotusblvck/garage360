import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Estado vacío para módulos aún no implementados. */
export function ModulePlaceholder({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <Card className="border border-dashed ring-0">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </span>
        <div className="grid gap-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">Próximo paso del roadmap. Incluirá:</p>
        </div>
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
