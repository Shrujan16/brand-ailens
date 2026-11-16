import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type Status } from "@/lib/data";

export function StatusBadge({ status }: { status: string }) {
  const s = (status in STATUS_LABEL ? status : "draft") as Status;
  return <Badge variant={s}>{STATUS_LABEL[s]}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity === "high" || severity === "low" ? severity : "medium";
  return (
    <Badge variant={s} className="uppercase tracking-wide text-[10px]">
      {s}
    </Badge>
  );
}
