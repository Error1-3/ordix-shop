"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({ side = "right", title, className, children }: { side?: "right" | "left" | "bottom"; title: string; className?: string; children: React.ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/40 backdrop-blur-[2px]" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          "fixed z-50 flex flex-col bg-background shadow-2xl focus:outline-none",
          side === "right" && "inset-y-0 right-0 w-[min(92vw,420px)] animate-sheet-in",
          side === "left" && "inset-y-0 left-0 w-[min(88vw,360px)] animate-sheet-in-left",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl animate-fade-in",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Close className="rounded-md p-1.5 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
