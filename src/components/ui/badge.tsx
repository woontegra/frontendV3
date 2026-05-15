import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        {
          "border-transparent bg-blue-600 text-white": variant === "default",
          "border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100": variant === "secondary",
          "border-gray-300 bg-transparent dark:border-gray-600 dark:text-gray-100": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };




