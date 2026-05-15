"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  upsertHoofTrimProtocol,
  deleteHoofTrimProtocol,
  upsertDewormingProtocol,
  deleteDewormingProtocol,
  upsertDryOffProtocol,
  deleteDryOffProtocol,
} from "./actions";

export type HoofRow = {
  id: string;
  slug: string;
  name: string;
  target_class: string;
  description: string | null;
  is_seed: boolean;
};
export type DewormRow = HoofRow; // identical shape
export type DryOffRow = {
  id: string;
  slug: string;
  name: string;
  approach_days: number;
  description: string | null;
  is_seed: boolean;
};

const targetClassHoof = ["lactating", "dry", "heifer", "fresh"] as const;
const targetClassDeworm = ["lactating", "dry", "heifer", "calf"] as const;

// ---------------------------------------------------------------------
// Hoof trim
// ---------------------------------------------------------------------
const hoofSchema = z.object({
  name: z.string().trim().min(1, "Name required.").max(120),
  description: z.string().trim().max(500),
  target_class: z.enum(targetClassHoof),
});
type HoofForm = z.infer<typeof hoofSchema>;

export function AddHoofTrimButton() {
  return (
    <HoofDialog
      mode="create"
      trigger={
        <Button type="button" size="sm">
          <HugeiconsIcon icon={PlusSignIcon} />
          Add protocol
        </Button>
      }
    />
  );
}

export function HoofTrimActions({ row }: { row: HoofRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  if (row.is_seed) {
    return (
      <span className="text-[10px] text-muted-foreground italic">read-only</span>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      <HoofDialog
        mode="edit"
        row={row}
        trigger={
          <Button type="button" size="sm" variant="outline">
            <HugeiconsIcon icon={PencilEdit02Icon} />
            Edit
          </Button>
        }
      />
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => {
          if (!confirm(`Delete "${row.name}"?`)) return;
          startTransition(async () => {
            const r = await deleteHoofTrimProtocol(row.id);
            if (r.error) {
              toast.error(r.error);
              return;
            }
            toast.success("Protocol deleted.");
            router.refresh();
          });
        }}
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </Button>
    </div>
  );
}

function HoofDialog({
  mode,
  row,
  trigger,
}: {
  mode: "create" | "edit";
  row?: HoofRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {open ? (
          <HoofBody
            mode={mode}
            row={row}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HoofBody({
  mode,
  row,
  onClose,
}: {
  mode: "create" | "edit";
  row?: HoofRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const form = useForm<HoofForm>({
    resolver: zodResolver(hoofSchema),
    defaultValues: {
      name: row?.name ?? "",
      description: row?.description ?? "",
      target_class:
        (row?.target_class as (typeof targetClassHoof)[number]) ?? "lactating",
    },
  });

  const onSubmit = (v: HoofForm) => {
    startTransition(async () => {
      const r = await upsertHoofTrimProtocol({
        id: row?.id,
        name: v.name,
        description: v.description || null,
        target_class: v.target_class,
        schedule: [],
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(mode === "create" ? "Protocol added." : "Protocol updated.");
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Add hoof-trim protocol" : "Edit hoof-trim protocol"}
        </DialogTitle>
        <DialogDescription>
          Name your SOP and pick the target class. Schedule steps can be
          edited later from the protocol detail (coming next).
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    placeholder="e.g. Twice-yearly maintenance"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="target_class"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target class</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {targetClassHoof.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : mode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

// ---------------------------------------------------------------------
// Deworming
// ---------------------------------------------------------------------
const dewormSchema = z.object({
  name: z.string().trim().min(1, "Name required.").max(120),
  description: z.string().trim().max(500),
  target_class: z.enum(targetClassDeworm),
});
type DewormForm = z.infer<typeof dewormSchema>;

export function AddDewormingButton() {
  return (
    <DewormDialog
      mode="create"
      trigger={
        <Button type="button" size="sm">
          <HugeiconsIcon icon={PlusSignIcon} />
          Add protocol
        </Button>
      }
    />
  );
}

export function DewormingActions({ row }: { row: DewormRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  if (row.is_seed) {
    return (
      <span className="text-[10px] text-muted-foreground italic">read-only</span>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      <DewormDialog
        mode="edit"
        row={row}
        trigger={
          <Button type="button" size="sm" variant="outline">
            <HugeiconsIcon icon={PencilEdit02Icon} />
            Edit
          </Button>
        }
      />
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => {
          if (!confirm(`Delete "${row.name}"?`)) return;
          startTransition(async () => {
            const r = await deleteDewormingProtocol(row.id);
            if (r.error) {
              toast.error(r.error);
              return;
            }
            toast.success("Protocol deleted.");
            router.refresh();
          });
        }}
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </Button>
    </div>
  );
}

function DewormDialog({
  mode,
  row,
  trigger,
}: {
  mode: "create" | "edit";
  row?: DewormRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {open ? (
          <DewormBody
            mode={mode}
            row={row}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DewormBody({
  mode,
  row,
  onClose,
}: {
  mode: "create" | "edit";
  row?: DewormRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const form = useForm<DewormForm>({
    resolver: zodResolver(dewormSchema),
    defaultValues: {
      name: row?.name ?? "",
      description: row?.description ?? "",
      target_class:
        (row?.target_class as (typeof targetClassDeworm)[number]) ??
        "lactating",
    },
  });

  const onSubmit = (v: DewormForm) => {
    startTransition(async () => {
      const r = await upsertDewormingProtocol({
        id: row?.id,
        name: v.name,
        description: v.description || null,
        target_class: v.target_class,
        schedule: [],
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(mode === "create" ? "Protocol added." : "Protocol updated.");
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Add deworming protocol" : "Edit deworming protocol"}
        </DialogTitle>
        <DialogDescription>
          Anthelmintic schedule. Drug + dose + withdrawal can be added per
          step on the protocol detail (coming next).
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="target_class"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target class</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {targetClassDeworm.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : mode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

// ---------------------------------------------------------------------
// Dry-off
// ---------------------------------------------------------------------
const dryOffSchema = z.object({
  name: z.string().trim().min(1, "Name required.").max(120),
  description: z.string().trim().max(500),
  approach_days: z.number().int().min(0).max(120),
  strategy: z.enum(["blanket", "selective", "no_antibiotic"]),
  antibiotic: z.string().trim().max(160),
  sealant: z.string().trim().max(120),
});
type DryOffForm = z.infer<typeof dryOffSchema>;

export function AddDryOffButton() {
  return (
    <DryOffDialog
      mode="create"
      trigger={
        <Button type="button" size="sm">
          <HugeiconsIcon icon={PlusSignIcon} />
          Add protocol
        </Button>
      }
    />
  );
}

export function DryOffActions({ row }: { row: DryOffRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  if (row.is_seed) {
    return (
      <span className="text-[10px] text-muted-foreground italic">read-only</span>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      <DryOffDialog
        mode="edit"
        row={row}
        trigger={
          <Button type="button" size="sm" variant="outline">
            <HugeiconsIcon icon={PencilEdit02Icon} />
            Edit
          </Button>
        }
      />
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => {
          if (!confirm(`Delete "${row.name}"?`)) return;
          startTransition(async () => {
            const r = await deleteDryOffProtocol(row.id);
            if (r.error) {
              toast.error(r.error);
              return;
            }
            toast.success("Protocol deleted.");
            router.refresh();
          });
        }}
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </Button>
    </div>
  );
}

function DryOffDialog({
  mode,
  row,
  trigger,
}: {
  mode: "create" | "edit";
  row?: DryOffRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {open ? (
          <DryOffBody
            mode={mode}
            row={row}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DryOffBody({
  mode,
  row,
  onClose,
}: {
  mode: "create" | "edit";
  row?: DryOffRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const form = useForm<DryOffForm>({
    resolver: zodResolver(dryOffSchema),
    defaultValues: {
      name: row?.name ?? "",
      description: row?.description ?? "",
      approach_days: row?.approach_days ?? 60,
      strategy: "blanket",
      antibiotic: "",
      sealant: "Bismuth subnitrate",
    },
  });

  const onSubmit = (v: DryOffForm) => {
    startTransition(async () => {
      const treatment: Record<string, unknown> = {
        strategy: v.strategy,
        sealant: v.sealant || null,
      };
      if (v.strategy !== "no_antibiotic" && v.antibiotic) {
        treatment.antibiotic = v.antibiotic;
      }
      const r = await upsertDryOffProtocol({
        id: row?.id,
        name: v.name,
        description: v.description || null,
        approach_days: v.approach_days,
        treatment,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(mode === "create" ? "Protocol added." : "Protocol updated.");
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Add dry-off protocol" : "Edit dry-off protocol"}
        </DialogTitle>
        <DialogDescription>
          Dry-cow therapy plan. Strategy decides who gets antibiotic;
          sealant is normally applied to every cow regardless.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="approach_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approach days</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(Number(e.target.value || 0))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Strategy</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blanket">
                          Blanket (all cows get antibiotic)
                        </SelectItem>
                        <SelectItem value="selective">
                          Selective (SCC-driven)
                        </SelectItem>
                        <SelectItem value="no_antibiotic">
                          Sealant only (no antibiotic)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="antibiotic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Antibiotic (drug + dose)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Cefquinome 150 mg/quarter (LA)"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sealant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sealant</FormLabel>
                <FormControl>
                  <Input placeholder="Bismuth subnitrate" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : mode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
