"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import { useTransition } from "react"
import { useTheme } from "next-themes"
import { FarmInsightLogo } from "./farminsight-logo"
import { HugeiconsIcon } from "@hugeicons/react"
import { logout } from "@/app/logout/actions"
import { PathHome } from "@/lib/misc"
import { Moon02Icon, Sun, User } from "@hugeicons/core-free-icons"
import { WORKSPACES, workspaceForPath } from "@/lib/workspaces"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export type SidebarUser = {
  email: string
  name: string | null
  role: string | null
}

export type SidebarBadgeCounts = {
  hotList: number
  groupMoves: number
  penMoves: number
}

const ZERO_COUNTS: SidebarBadgeCounts = {
  hotList: 0,
  groupMoves: 0,
  penMoves: 0,
}

function badgeFor(key: string, c: SidebarBadgeCounts): number {
  if (key === "hot-list") return c.hotList
  if (key === "herd") return c.groupMoves + c.penMoves
  return 0
}

function badgeTone(key: string): "destructive" | "amber" {
  return key === "hot-list" ? "destructive" : "amber"
}

export function AppSidebar({
  user,
  badgeCounts = ZERO_COUNTS,
}: {
  user: SidebarUser
  badgeCounts?: SidebarBadgeCounts
}) {
  const pathname = usePathname()
  const activeKey = workspaceForPath(pathname)?.key ?? null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href={PathHome}
          className="px-2 py-3 text-sidebar-foreground group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
        >
          <FarmInsightLogo collapsible />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORKSPACES.filter(
                (w) => user.role && w.roles.includes(user.role),
              ).map((w) => {
                const badge = badgeFor(w.key, badgeCounts)
                const tone = badgeTone(w.key)
                const active = activeKey === w.key
                return (
                  <SidebarMenuItem key={w.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={badge > 0 ? `${w.label} (${badge})` : w.label}
                    >
                      <Link
                        href={w.href}
                        className="flex items-center w-full"
                      >
                        <HugeiconsIcon icon={w.icon} />
                        <span className="flex-1">{w.label}</span>
                        {badge > 0 ? (
                          <span
                            className={`ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10px] font-medium tabular-nums leading-none group-data-[collapsible=icon]:hidden ${
                              tone === "destructive"
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-amber-500 text-amber-50 dark:text-amber-950"
                            }`}
                            aria-label={`${badge} pending`}
                          >
                            {badge > 99 ? "99+" : badge}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-row justify-between items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function UserMenu({ user }: { user: SidebarUser }) {
  const [isPending, startTransition] = useTransition()
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant={"ghost"}>
            <HugeiconsIcon icon={User} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={"w-full"}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-normal">
              <span className="text-muted-foreground">Name: </span>
              <span>{user.name ?? "—"}</span>
            </DropdownMenuLabel>
            <DropdownMenuLabel className="font-normal">
              <span className="text-muted-foreground">Email: </span>
              <span>{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => startTransition(() => logout())}>
              {isPending ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <Button
        type="button"
        variant={"ghost"}
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {
          theme === "light" ? <HugeiconsIcon icon={Sun} /> : <HugeiconsIcon icon={Moon02Icon} />
        }
      </Button>
    </div>
  )
}
