"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { FarmInsightLogo } from "./farminsight-logo"
import { HugeiconsIcon } from "@hugeicons/react"
import { logout } from "@/app/logout/actions"
import {
  PathWork,
  PathCows,
  PathAnalyze,
  PathSetup,
  PathHome,
  PathAdminOrganizations,
  PathAdminUsers,
  RoleAdmin,
  RoleSuperAdmin,
  cowPath,
} from "@/lib/misc"
import { Moon02Icon, Sun, User } from "@hugeicons/core-free-icons"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

// The whole daily loop is four destinations + the command bar (doctrine #8).
const SPINE = [
  { name: "Work", link: PathWork },
  { name: "Cows", link: PathCows },
  { name: "Analyze", link: PathAnalyze },
  { name: "Set-up", link: PathSetup },
]

const ADMIN = [
  { name: "User Management", link: PathAdminUsers },
  { name: "Organizations", link: PathAdminOrganizations },
]

export function AppSidebar({ user }: { user: SidebarUser }) {
  const isAdmin = user.role === RoleAdmin || user.role === RoleSuperAdmin

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={PathHome} className="px-2 py-3 text-sidebar-foreground">
          <FarmInsightLogo />
        </Link>
        <CowLookup />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Herd</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SPINE.map((i) => (
                <SidebarMenuItem key={i.name}>
                  <SidebarMenuButton asChild>
                    <Link href={i.link}>
                      <span>{i.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN.map((i) => (
                  <SidebarMenuItem key={i.name}>
                    <SidebarMenuButton asChild>
                      <Link href={i.link}>
                        <span>{i.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-row justify-between items-center">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

// Doctrine #8: you ask for the cow, you don't hunt a menu. Enter a tag ->
// straight to that cow's record; otherwise search the herd.
function CowLookup() {
  const router = useRouter()
  const [q, setQ] = useState("")
  return (
    <form
      className="px-2 pb-2"
      onSubmit={(e) => {
        e.preventDefault()
        const v = q.trim()
        if (!v) return
        router.push(cowPath(v))
      }}
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find cow by tag…"
        className="h-8 text-xs"
        autoComplete="off"
        inputMode="numeric"
      />
    </form>
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
        {theme === "light" ? <HugeiconsIcon icon={Sun} /> : <HugeiconsIcon icon={Moon02Icon} />}
      </Button>
    </div>
  )
}
