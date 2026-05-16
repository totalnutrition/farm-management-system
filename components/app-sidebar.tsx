"use client"

import Link from "next/link"
import { Button } from "./ui/button"
import { useTransition } from "react"
import { useTheme } from "next-themes"
import { FarmInsightLogo } from "./farminsight-logo"
import { HugeiconsIcon } from "@hugeicons/react"
import { logout } from "@/app/logout/actions"
import { PathAdminOrganizations, PathAdminUsers, PathHome, PathQuery, PathRecords, PathViews, PathGrouping, PathPens, PathMonitor, PathProtocols, PathFeed, PathSettings, PathAudit, PathSharing, PathExtended, PathImport, PathHealth, PathBarns, PathSires, PathActivity, RolesAll, RolesAdmin } from "@/lib/misc"
import { Analytics01Icon, Building03Icon, Calendar03Icon, ClipboardIcon, Dna01Icon, DistributionIcon, FileImportIcon, FirstAidKitIcon, Home03Icon, Layers01Icon, Moon02Icon, Search01Icon, Settings01Icon, Sun, Time01Icon, User, UserGroupIcon, ViewIcon, WheatIcon } from "@hugeicons/core-free-icons"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"

export type SidebarUser = {
  email: string
  name: string | null
  role: string | null
}

const MENU = [
  {
    label: "Herd",
    links: [
      { name: "Animals", icon: ClipboardIcon, link: PathRecords, roles: RolesAll },
      { name: "Query", icon: Search01Icon, link: PathQuery, roles: RolesAll },
      { name: "Barns", icon: Home03Icon, link: PathBarns, roles: RolesAll },
      { name: "Pens", icon: Layers01Icon, link: PathPens, roles: RolesAll },
      { name: "Sires & Semen", icon: Dna01Icon, link: PathSires, roles: RolesAll },
      { name: "Grouping", icon: DistributionIcon, link: PathGrouping, roles: RolesAll },
      { name: "Activity", icon: ClipboardIcon, link: PathActivity, roles: RolesAll },
      { name: "Health", icon: FirstAidKitIcon, link: PathHealth, roles: RolesAll },
      { name: "Protocols", icon: Calendar03Icon, link: PathProtocols, roles: RolesAll },
      { name: "Feed", icon: WheatIcon, link: PathFeed, roles: RolesAll },
      { name: "Monitor", icon: Analytics01Icon, link: PathMonitor, roles: RolesAll },
      { name: "Views", icon: ViewIcon, link: PathViews, roles: RolesAll },
      { name: "Bulk Import", icon: FileImportIcon, link: PathImport, roles: RolesAdmin },
      { name: "Extended Services", icon: Layers01Icon, link: PathExtended, roles: RolesAll }
    ],
    roles: RolesAll
  },
  {
    label: "Administration",
    links: [
      { name: "User Management", icon: UserGroupIcon, link: PathAdminUsers, roles: RolesAdmin },
      { name: "Organizations", icon: Building03Icon, link: PathAdminOrganizations, roles: RolesAdmin },
      { name: "External Access", icon: UserGroupIcon, link: PathSharing, roles: RolesAdmin },
      { name: "Settings", icon: Settings01Icon, link: PathSettings, roles: RolesAdmin },
      { name: "Audit Log", icon: Time01Icon, link: PathAudit, roles: RolesAdmin }
    ],
    roles: RolesAdmin
  }
]

export function AppSidebar({ user }: { user: SidebarUser }) {
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={PathHome} className="px-2 py-3 text-sidebar-foreground">
          <FarmInsightLogo />
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
                        <SidebarMenuButton asChild>
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
        <div className={`flex flex-row justify-between items-center`}>
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