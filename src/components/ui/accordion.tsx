"use client";
import * as React from "react";
import * as A from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = A.Root;
export const AccordionItem = ({ className, ...p }: React.ComponentProps<typeof A.Item>) => <A.Item className={cn("border-b border-border", className)} {...p} />;
export function AccordionTrigger({ className, children, ...p }: React.ComponentProps<typeof A.Trigger>) {
  return (
    <A.Header className="flex">
      <A.Trigger className={cn("flex flex-1 items-center justify-between py-4 text-left text-[15px] font-medium transition-all [&[data-state=open]>svg]:rotate-180", className)} {...p}>
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </A.Trigger>
    </A.Header>
  );
}
export function AccordionContent({ className, children, ...p }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Content className="overflow-hidden text-sm text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" {...p}>
      <div className={cn("pb-4 leading-relaxed", className)}>{children}</div>
    </A.Content>
  );
}
