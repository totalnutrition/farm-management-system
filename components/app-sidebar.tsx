"use client"

import Link from "next/link"
import { Button } from "./ui/button"
import { useTransition } from "react"
import { useTheme } from "next-themes"
import { FarmInsightLogo } from "./farminsight-logo"
import { HugeiconsIcon } from "@hugeicons/react"
import { logout } from "@/app/logout/actions"
import { PathHome, PathSettings, RoleAdmin, RoleSuperAdmin } from "@/lib/misc"
import {
  Moon02Icon,
  Settings02Icon,
  Sun,
  User,
  DashboardSquare01Icon,
  WheatIcon,
  AlertCircleIcon,
  ChartLineData02Icon,
  ClipboardClockIcon,
  MedicalFileIcon,
  TruckIcon,
  Calendar03Icon,
  Package01Icon,
  Notebook01Icon,
  SpermIcon,
  CookBookIcon,
  AlarmClockIcon,
  Building02Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons"
import { CowFaceIcon } from "@/lib/custom-icons"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"

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

type HugeIcon = Parameters<typeof HugeiconsIcon>[0]["icon"]

type MenuLink = {
  name: string
  icon: HugeIcon
  link: string
  roles: string[]
}

type MenuGroup = {
  label: string
  links: MenuLink[]
  roles: string[]
}

const ROLES = [RoleSuperAdmin, RoleAdmin]

const MENU: MenuGroup[] = [
  {
    label: "Operations",
    roles: ROLES,
    links: [
      { name: "Dashboard",     icon: DashboardSquare01Icon, link: "/",               roles: ROLES },
      { name: "Hot list",      icon: AlertCircleIcon,       link: "/hot-list",       roles: ROLES },
      { name: "Rounds",        icon: ClipboardClockIcon,    link: "/rounds",         roles: ROLES },
      { name: "Calendar",      icon: Calendar03Icon,        link: "/calendar",       roles: ROLES },
    ],
  },
  {
    label: "Herd",
    roles: ROLES,
    links: [
      { name: "Animals",       icon: CowFaceIcon,           link: "/animals",        roles: ROLES },
      { name: "Group moves",   icon: TruckIcon,             link: "/group-moves",    roles: ROLES },
      { name: "Pen moves",     icon: TruckIcon,             link: "/pen-moves",      roles: ROLES },
    ],
  },
  {
    label: "Reproduction",
    roles: ROLES,
    links: [
      { name: "Reproduction",  icon: SpermIcon,             link: "/reproduction",   roles: ROLES },
    ],
  },
  {
    label: "Health",
    roles: ROLES,
    links: [
      { name: "Health",        icon: MedicalFileIcon,       link: "/health",         roles: ROLES },
    ],
  },
  {
    label: "Milk",
    roles: ROLES,
    links: [
      { name: "Milk",          icon: ClipboardClockIcon,    link: "/milk",           roles: ROLES },
    ],
  },
  {
    label: "Feed & Nutrition",
    roles: ROLES,
    links: [
      { name: "Feeding",       icon: CookBookIcon,          link: "/feeding",        roles: ROLES },
      { name: "Recipes",       icon: Notebook01Icon,        link: "/recipes",        roles: ROLES },
    ],
  },
  {
    label: "Crops",
    roles: ROLES,
    links: [
      { name: "Forage & crops", icon: WheatIcon,            link: "/crops",          roles: ROLES },
    ],
  },
  {
    label: "Inventory",
    roles: ROLES,
    links: [
      { name: "Stocks",        icon: Package01Icon,         link: "/stocks",         roles: ROLES },
      { name: "Procurement",   icon: ShoppingCart01Icon,    link: "/procurement",    roles: ROLES },
      { name: "Vendors",       icon: Building02Icon,        link: "/vendors",        roles: ROLES },
    ],
  },
  {
    label: "People",
    roles: ROLES,
    links: [
      { name: "People",        icon: AlarmClockIcon,        link: "/people",         roles: ROLES },
    ],
  },
  {
    label: "Records",
    roles: ROLES,
    links: [
      { name: "Reports",       icon: Notebook01Icon,        link: "/reports",        roles: ROLES },
      { name: "Transactions",  icon: ChartLineData02Icon,   link: "/transactions",   roles: ROLES },
    ],
  },
  {
    label: "Workspace",
    roles: ROLES,
    links: [
      { name: "Settings",      icon: Settings02Icon,        link: PathSettings,      roles: ROLES },
    ],
  },
]

function badgeFor(link: string, counts: SidebarBadgeCounts): number {
  if (link === "/hot-list") return counts.hotList
  if (link === "/group-moves") return counts.groupMoves
  if (link === "/pen-moves") return counts.penMoves
  return 0
}

function badgeTone(link: string): "destructive" | "amber" {
  return link === "/hot-list" ? "destructive" : "amber"
}

export function AppSidebar({
  user,
  badgeCounts = ZERO_COUNTS,
}: {
  user: SidebarUser
  badgeCounts?: SidebarBadgeCounts
}) {
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
        {MENU.map((i) =>
          user.role && i.roles.includes(user.role) && (
            <SidebarGroup key={i.label}>
              <SidebarGroupLabel>{i.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {i.links.map((j) => {
                    if (!user.role || !j.roles.includes(user.role)) return null
                    const badge = badgeFor(j.link, badgeCounts)
                    const tone = badgeTone(j.link)
                    return (
                      <SidebarMenuItem key={j.name}>
                        <SidebarMenuButton
                          asChild
                          tooltip={badge > 0 ? `${j.name} (${badge})` : j.name}
                        >
                          <Link href={j.link} className="flex items-center w-full">
                            <HugeiconsIcon icon={j.icon} />
                            <span className="flex-1">{j.name}</span>
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
          ),
        )}
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
