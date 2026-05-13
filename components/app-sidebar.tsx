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
} from "@hugeicons/core-free-icons"
import { CowFaceIcon } from "@/lib/custom-icons"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"

export type SidebarUser = {
  email: string
  name: string | null
  role: string | null
}

type HugeIcon = Parameters<typeof HugeiconsIcon>[0]["icon"];

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

const MENU: MenuGroup[] = [
  {
    label: "Operations",
    roles: [RoleSuperAdmin, RoleAdmin],
    links: [
      {
        name: "Dashboard",
        icon: DashboardSquare01Icon,
        link: PathHome,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
      {
        name: "Animals",
        icon: CowFaceIcon,
        link: "/animals",
        roles: [RoleSuperAdmin, RoleAdmin],
      },
      {
        name: "Forage & crops",
        icon: WheatIcon,
        link: "/crops",
        roles: [RoleSuperAdmin, RoleAdmin],
      },
    ],
  },
  {
    label: "Workspace",
    roles: [RoleSuperAdmin, RoleAdmin],
    links: [
      {
        name: "Settings",
        icon: Settings02Icon,
        link: PathSettings,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
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
        {
          MENU.map((i) =>
            (
              user.role &&
              i.roles.includes(user.role)
            ) &&
            <SidebarGroup key={i.label}>
              <SidebarGroupLabel>{i.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {
                    i.links.map((j) =>
                      (
                        user.role &&
                        j.roles.includes(user.role)
                      ) &&
                      <SidebarMenuItem key={j.name}>
                        <SidebarMenuButton asChild tooltip={j.name}>
                          <Link href={j.link}>
                            <HugeiconsIcon icon={j.icon} />
                            <span>{j.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        }
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
