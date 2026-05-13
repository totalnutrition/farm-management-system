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
  TaskDaily01Icon,
  Calendar03Icon,
  PackageIcon,
  Notebook01Icon,
} from "@hugeicons/core-free-icons"
import { CowFaceIcon } from "@/lib/custom-icons"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"

export type SidebarUser = {
  email: string
  name: string | null
  role: string | null
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
      { name: "Dashboard",    icon: DashboardSquare01Icon, link: "/",            roles: ROLES },
      { name: "Hot list",     icon: AlertCircleIcon,        link: "/hot-list",    roles: ROLES },
      { name: "Animals",      icon: CowFaceIcon,            link: "/animals",     roles: ROLES },
    ],
  },
  {
    label: "Reproduction",
    roles: ROLES,
    links: [
      { name: "Heats",        icon: ChartLineData02Icon,    link: "/heats",       roles: ROLES },
      { name: "Breedings",    icon: ChartLineData02Icon,    link: "/breedings",   roles: ROLES },
      { name: "Preg checks",  icon: ChartLineData02Icon,    link: "/preg-checks", roles: ROLES },
      { name: "Calvings",     icon: ChartLineData02Icon,    link: "/calvings",    roles: ROLES },
    ],
  },
  {
    label: "Health",
    roles: ROLES,
    links: [
      { name: "Health events", icon: MedicalFileIcon,       link: "/health",      roles: ROLES },
      { name: "Withdrawals",  icon: AlertCircleIcon,        link: "/withdrawals", roles: ROLES },
    ],
  },
  {
    label: "Milk",
    roles: ROLES,
    links: [
      { name: "Milk recording", icon: ClipboardClockIcon,   link: "/milk-recording", roles: ROLES },
      { name: "Test days",    icon: TaskDaily01Icon,        link: "/test-days",    roles: ROLES },
    ],
  },
  {
    label: "Movements",
    roles: ROLES,
    links: [
      { name: "Pen moves",    icon: TruckIcon,              link: "/pen-moves",   roles: ROLES },
      { name: "Transactions", icon: PackageIcon,            link: "/transactions",roles: ROLES },
    ],
  },
  {
    label: "Crops",
    roles: ROLES,
    links: [
      { name: "Forage & crops", icon: WheatIcon,            link: "/crops",       roles: ROLES },
    ],
  },
  {
    label: "Reports",
    roles: ROLES,
    links: [
      { name: "Reports",      icon: Notebook01Icon,         link: "/reports",     roles: ROLES },
      { name: "Calendar",     icon: Calendar03Icon,         link: "/calendar",    roles: ROLES },
    ],
  },
  {
    label: "Workspace",
    roles: ROLES,
    links: [
      { name: "Settings",     icon: Settings02Icon,         link: PathSettings,   roles: ROLES },
    ],
  },
]

export function AppSidebar({ user }: { user: SidebarUser }) {
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
                  {i.links.map((j) =>
                    user.role && j.roles.includes(user.role) && (
                      <SidebarMenuItem key={j.name}>
                        <SidebarMenuButton asChild tooltip={j.name}>
                          <Link href={j.link}>
                            <HugeiconsIcon icon={j.icon} />
                            <span>{j.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ),
                  )}
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
