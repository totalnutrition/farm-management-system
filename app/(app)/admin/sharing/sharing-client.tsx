"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addShare, removeShare } from "./actions";

export type ShareRow = {
  id: string;
  email: string;
  role: string;
  scope: string;
};

export function SharingClient({ rows }: { rows: ShareRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"vet" | "nutritionist" | "viewer">("vet");
  const [scope, setScope] = useState<"read" | "write">("read");

  const submit = () =>
    start(async () => {
      const res = await addShare({ email, role, scope });
      if (res.error) return void toast.error(res.error);
      toast.success(`Access granted to ${email}.`);
      setEmail("");
      router.refresh();
    });

  const remove = (r: ShareRow) =>
    start(async () => {
      const res = await removeShare(r.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Revoked ${r.email}.`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No external access granted.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Scope</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.email}</td>
                  <td className="px-3 py-2">{r.role}</td>
                  <td className="px-3 py-2">{r.scope}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => remove(r)}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              className="h-8 w-56 text-xs"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vet@clinic.com"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select
              value={role}
              onValueChange={(v) =>
                setRole(v as "vet" | "nutritionist" | "viewer")
              }
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vet">Veterinarian</SelectItem>
                <SelectItem value="nutritionist">Nutritionist</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as "read" | "write")}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="write">Read &amp; write</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={pending || !email}
            onClick={submit}
          >
            Grant access
          </Button>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Note: invited externals appear here now; scoped sign-in
        enforcement for external accounts is the next step.
      </p>
    </div>
  );
}
