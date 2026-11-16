import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        high: "border-transparent bg-sev-high-soft text-sev-high",
        medium: "border-transparent bg-sev-medium-soft text-sev-medium",
        low: "border-transparent bg-sev-low-soft text-sev-low",
        category: "border-border bg-card text-foreground font-medium",
        draft: "border-transparent bg-muted text-muted-foreground",
        in_review: "border-transparent bg-harvest-soft text-harvest-foreground",
        changes_requested: "border-transparent bg-sev-high-soft text-sev-high",
        approved: "border-transparent bg-success-soft text-primary-deep",
        harvest: "border-transparent bg-harvest text-harvest-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
