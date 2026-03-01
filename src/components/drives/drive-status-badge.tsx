import { Badge } from "@/components/ui/badge";

type DriveStatus = "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

const statusConfig: Record<
  DriveStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  DRAFT:     { label: "Draft",     variant: "secondary"    },
  UPCOMING:  { label: "Upcoming",  variant: "outline"      },
  ACTIVE:    { label: "Active",    variant: "default"      },
  COMPLETED: { label: "Completed", variant: "secondary"    },
  CANCELLED: { label: "Cancelled", variant: "destructive"  },
};

export function DriveStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as DriveStatus] ?? {
    label: status,
    variant: "secondary" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
