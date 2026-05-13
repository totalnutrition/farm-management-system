"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Delete02Icon } from "@hugeicons/core-free-icons";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type LocationAccessRow,
  revokeLocationAccess,
  upsertLocationAccess,
} from "./access-actions";

const SECTION_SLUGS = [
  "general",
  "recording",
  "infrastructure",
  "groups",
  "milk-pricing",
  "bulk-tank",
  "integrations",
  "notifications",
  "directories",
  "custom-vocabularies",
];

const ACCESS_LEVELS = ["none", "view", "edit"] as const;
type AccessLevel = (typeof ACCESS_LEVELS)[number];

export function AccessClient({
  locationId,
  rows,
  orgUsers,
}: {
  locationId: string;
  rows: LocationAccessRow[];
  orgUsers: { id: string; email: string; name: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LocationAccessRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onDelete = (userId: string) => {
    startTransition(async () => {
      const result = await revokeLocationAccess({
        location_id: locationId,
        user_id: userId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Access revoked.");
      router.refresh();
    });
  };

  const usersWithoutAccess = orgUsers.filter(
    (u) => !rows.some((r) => r.user_id === u.id),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          Grant access
        </Button>
      </div>
      <div className="ring-1 ring-foreground/10 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Overrides</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No explicit access grants. Org admins always have full
                  access automatically.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0">
                      <span className="font-medium">{r.name ?? r.email}</span>
                      {r.name ? (
                        <span className="text-[10px] text-muted-foreground">
                          {r.email}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{r.default_access}</TableCell>
                  <TableCell className="text-[10px]">
                    {Object.entries(r.section_access)
                      .filter(([, v]) => v !== r.default_access)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => onDelete(r.user_id)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GrantDialog
        open={open}
        onClose={() => setOpen(false)}
        locationId={locationId}
        existing={editing}
        candidates={editing ? orgUsers.filter((u) => u.id === editing.user_id) : usersWithoutAccess}
      />
    </div>
  );
}

function GrantDialog({
  open,
  onClose,
  locationId,
  existing,
  candidates,
}: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  existing: LocationAccessRow | null;
  candidates: { id: string; email: string; name: string | null }[];
}) {
  const [userId, setUserId] = useState(existing?.user_id ?? candidates[0]?.id ?? "");
  const [defaultAccess, setDefaultAccess] = useState<AccessLevel>(
    existing?.default_access ?? "view",
  );
  const [sectionAccess, setSectionAccess] = useState<
    Record<string, AccessLevel>
  >(existing?.section_access ?? {});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onSave = () => {
    if (!userId) {
      toast.error("Pick a user.");
      return;
    }
    startTransition(async () => {
      const result = await upsertLocationAccess({
        location_id: locationId,
        user_id: userId,
        default_access: defaultAccess,
        section_access: sectionAccess,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(existing ? "Access updated." : "Access granted.");
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogTrigger asChild>
        <span />
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit access" : "Grant access"}</DialogTitle>
          <DialogDescription>
            Set the default level, then optionally override per section.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {!existing ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs">User</label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a user" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      All org users already have access
                    </SelectItem>
                  ) : (
                    candidates.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <label className="text-xs">Default access</label>
            <Select
              value={defaultAccess}
              onValueChange={(v) => setDefaultAccess(v as AccessLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_LEVELS.map((l) => (
                  <SelectItem key={l} value={l} className="capitalize">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Per-section overrides</label>
            <div className="ring-1 ring-foreground/10 max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-foreground/5">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Section</th>
                    <th className="px-3 py-2 font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTION_SLUGS.map((s) => (
                    <tr key={s} className="border-t border-foreground/10">
                      <td className="px-3 py-1.5">{s}</td>
                      <td className="px-3 py-1.5">
                        <Select
                          value={sectionAccess[s] ?? "__inherit"}
                          onValueChange={(v) =>
                            setSectionAccess((prev) => {
                              const next = { ...prev };
                              if (v === "__inherit") delete next[s];
                              else next[s] = v as AccessLevel;
                              return next;
                            })
                          }
                        >
                          <SelectTrigger className="h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__inherit">
                              <span className="italic text-muted-foreground">
                                Inherit ({defaultAccess})
                              </span>
                            </SelectItem>
                            {ACCESS_LEVELS.map((l) => (
                              <SelectItem key={l} value={l} className="capitalize">
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
