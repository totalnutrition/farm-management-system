"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTransition } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building03Icon,
  Moon02Icon,
  Sun,
  TractorIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "./ui/button"
import { logout } from "@/app/logout/actions"
import {
  PathAdminOrganizations,
  PathAdminUsers,
  PathHome,
  PathLocations,
  RoleAdmin,
  RoleSuperAdmin,
} from "@/lib/misc"
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

const MENU = [
  {
    label: "Farm",
    links: [
      {
        name: "Locations",
        icon: TractorIcon,
        link: PathLocations,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
    ],
    roles: [RoleSuperAdmin, RoleAdmin],
  },
  {
    label: "Administration",
    links: [
      {
        name: "Users",
        icon: UserGroupIcon,
        link: PathAdminUsers,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
      {
        name: "Organizations",
        icon: Building03Icon,
        link: PathAdminOrganizations,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
    ],
    roles: [RoleSuperAdmin, RoleAdmin],
  },
]

export function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-foreground/10 px-3 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
        <Link
          href={PathHome}
          className="flex flex-col leading-none group-data-[collapsible=icon]:items-center"
        >
          <span className="font-heading text-xl font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:text-base">
            Insight
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/65 group-data-[collapsible=icon]:hidden">
            by Total Nutrition
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {MENU.map((group) => {
          if (!user.role || !group.roles.includes(user.role)) return null
          return (
            <SidebarGroup key={group.label} className="px-1.5 py-2">
              <SidebarGroupLabel className="px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.links.map((link) => {
                    if (!user.role || !link.roles.includes(user.role)) return null
                    const active =
                      pathname === link.link ||
                      pathname.startsWith(link.link + "/")
                    return (
                      <SidebarMenuItem key={link.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={link.name}
                          className="text-sidebar-foreground/85 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground data-active:bg-sidebar-foreground data-active:text-[oklch(0.5028_0.1677_328.15)]"
                        >
                          <Link href={link.link}>
                            <HugeiconsIcon icon={link.icon} />
                            <span>{link.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-foreground/10 px-1.5 py-1.5">
        <div className="flex items-center justify-between gap-1 group-data-[collapsible=icon]:flex-col">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function UserMenu({ user }: { user: SidebarUser }) {
  const [isPending, startTransition] = useTransition()
  const initials = (user.name ?? user.email ?? "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const display =
    user.name ?? (user.email ? user.email.split("@")[0] : "Account")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 min-w-0 flex-1 justify-start gap-1.5 px-1.5 text-xs text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sidebar-foreground/15 text-[9px] font-semibold">
            {initials || "?"}
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">
            {display}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">{user.name ?? "—"}</span>
            <span className="text-[10px] text-muted-foreground">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onSelect={() => startTransition(() => logout())}
          className="text-xs"
        >
          {isPending ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label="Toggle theme"
    >
      <HugeiconsIcon
        icon={theme === "light" ? Sun : Moon02Icon}
        className="size-3.5"
      />
    </Button>
  )
}
