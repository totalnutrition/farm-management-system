"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "./ui/button"
import { useTransition } from "react"
import { useTheme } from "next-themes"
import Logo from "@/public/insight-dark.png"
import { HugeiconsIcon } from "@hugeicons/react"
import { logout } from "@/app/logout/actions"
import { PathAdminOrganizations, PathAdminUsers, PathHome, RoleAdmin, RoleSuperAdmin } from "@/lib/misc"
import { Building03Icon, Moon02Icon, Sun, User, UserGroupIcon } from "@hugeicons/core-free-icons"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"

export type SidebarUser = {
  email: string
  name: string | null
  role: string | null
}

const MENU = [
  {
    label: "Administration",
    links: [
      {
        name: "User Management",
        icon: UserGroupIcon,
        link: PathAdminUsers,
        roles: [RoleSuperAdmin, RoleAdmin]
      },
      {
        name: "Organizations",
        icon: Building03Icon,
        link: PathAdminOrganizations,
        roles: [RoleSuperAdmin, RoleAdmin]
      }
    ],
    roles: [RoleSuperAdmin, RoleAdmin]
  }
]

export function AppSidebar({ user }: { user: SidebarUser }) {
  return (
    <Sidebar>
      <SidebarHeader className="text-center">
        <div>
          <Link href={PathHome}>
            <Image
              src={Logo.src}
              height={Logo.height}
              width={Logo.width}
              alt="Logo"
              className="w-full h-auto pl-2"
            />
          </Link>
        </div>
        <div className="font-semibold uppercase text-sidebar-foreground">FARM MANAGEMENT SYSTEM</div>
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