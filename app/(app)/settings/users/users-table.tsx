"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleAdmin, RoleSuperAdmin, RoleView } from "@/lib/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAdminUser,
  deleteAdminUser,
  setAdminUserActive,
  updateAdminUser,
  updateMyProfile,
} from "./actions";

export type AdminRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  organization_id: string | null;
  organization_name: string | null;
};

const createSchema = z
  .object({
    full_name: z.string().trim().min(1, "Name is required."),
    email: z.email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    role: z.enum([RoleSuperAdmin, RoleAdmin]),
    organization_name: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.role === RoleAdmin && !data.organization_name) {
      ctx.addIssue({
        code: "custom",
        path: ["organization_name"],
        message: "Organization name is required.",
      });
    }
  });
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required."),
  organization_name: z.string().trim().min(1, "Organization name is required."),
});
type EditValues = z.infer<typeof editSchema>;

const selfEditSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required."),
});
type SelfEditValues = z.infer<typeof selfEditSchema>;

export function UsersTable({
  users,
  currentUserId,
  canManage,
}: {
  users: AdminRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [deleting, setDeleting] = useState<AdminRow | null>(null);
  const [editingSelf, setEditingSelf] = useState<AdminRow | null>(null);

  const hasSelfInList = users.some((u) => u.id === currentUserId);
  const showActions = canManage || hasSelfInList;
  const colCount = showActions ? 6 : 5;

  return (
    <div className="flex flex-col gap-3">
      {canManage ? (
        <div className="flex justify-end">
          <CreateDialog />
        </div>
      ) : null}
      <div className="ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              {showActions ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center text-muted-foreground"
                >
                  No users to show.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.full_name ?? "—"}
                      {isSelf ? (
                        <span className="ml-2 text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="capitalize">
                      {u.role.replace("_", " ")}
                    </TableCell>
                    <TableCell>{u.organization_name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge isActive={u.is_active} />
                    </TableCell>
                    {showActions ? (
                      <TableCell className="text-right">
                        {isSelf ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingSelf(u)}
                            >
                              <HugeiconsIcon icon={PencilEdit02Icon} />
                              Edit
                            </Button>
                          </div>
                        ) : canManage ? (
                          <div className="flex justify-end gap-1">
                            <ToggleActiveButton row={u} />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(u)}
                            >
                              <HugeiconsIcon icon={PencilEdit02Icon} />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleting(u)}
                            >
                              <HugeiconsIcon icon={Delete02Icon} />
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <EditDialog row={editing} onClose={() => setEditing(null)} />
      <SelfEditDialog row={editingSelf} onClose={() => setEditingSelf(null)} />
      <DeleteDialog row={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs ring-1",
        isActive
          ? "bg-green-500/10 text-green-700 ring-green-500/30 dark:text-green-400"
          : "bg-red-500/10 text-red-600 ring-red-500/30 dark:text-red-400",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          isActive ? "bg-green-500" : "bg-red-500",
        )}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function ToggleActiveButton({ row }: { row: AdminRow }) {
  const [isPending, startTransition] = useTransition();
  const next = !row.is_active;
  return (
    <Button
      type="button"
      size="sm"
      variant={row.is_active ? "outline" : "secondary"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await setAdminUserActive(row.id, next);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(next ? "User activated." : "User deactivated.");
        })
      }
    >
      {isPending
        ? row.is_active
          ? "Deactivating..."
          : "Activating..."
        : row.is_active
          ? "Deactivate"
          : "Activate"}
    </Button>
  );
}

function CreateDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: RoleAdmin,
      organization_name: "",
    },
  });

  const selectedRole = form.watch("role");

  const onSubmit = (values: CreateValues) => {
    startTransition(async () => {
      const result = await createAdminUser(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Admin user created.");
      form.reset();
      setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <HugeiconsIcon icon={PlusSignIcon} />
          New User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            {selectedRole === RoleSuperAdmin
              ? "Creates a Super Admin (no organization)."
              : "Creates a new client organization and an Admin user who owns it."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={RoleSuperAdmin}>
                        {RoleView[RoleSuperAdmin]}
                      </SelectItem>
                      <SelectItem value={RoleAdmin}>
                        {RoleView[RoleAdmin]}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedRole === RoleAdmin ? (
              <FormField
                control={form.control}
                name="organization_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization name</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  row,
  onClose,
}: {
  row: AdminRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: row
      ? {
          full_name: row.full_name ?? "",
          organization_name: row.organization_name ?? "",
        }
      : { full_name: "", organization_name: "" },
  });

  if (!row) return null;

  const onSubmit = (values: EditValues) => {
    startTransition(async () => {
      const result = await updateAdminUser({ id: row.id, ...values });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Admin user updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Admin User</DialogTitle>
          <DialogDescription>{row.email}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organization_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SelfEditDialog({
  row,
  onClose,
}: {
  row: AdminRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<SelfEditValues>({
    resolver: zodResolver(selfEditSchema),
    values: row
      ? { full_name: row.full_name ?? "" }
      : { full_name: "" },
  });

  if (!row) return null;

  const onSubmit = (values: SelfEditValues) => {
    startTransition(async () => {
      const result = await updateMyProfile(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Your Profile</DialogTitle>
          <DialogDescription>{row.email}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  row,
  onClose,
}: {
  row: AdminRow | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (!row) return null;

  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteAdminUser(row.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Admin user deleted.");
      onClose();
    });
  };

  return (
    <Dialog open={!!row} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Admin User</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{row.email}</strong> and the
            organization <strong>{row.organization_name ?? "—"}</strong>. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            <HugeiconsIcon icon={Delete02Icon} />
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
