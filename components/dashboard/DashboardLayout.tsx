"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutGrid,
  PlusCircle,
  LogOut,
  User,
  Menu,
  MessageSquare,
  Users,
  Store,
  Tag,
  Box,
  ChartColumn,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoWordmark from "@/assets/mirour-logo-galaxy.png";
import { trackEvent } from "@/lib/mixpanel";

const NAV_TABS = [
  { id: "myflows", label: "Flows", icon: LayoutGrid, href: "/myflows" },

  { id: "inventory", label: "Inventory", icon: Box, href: "/inventory" },
  { id: "stores", label: "Locations", icon: Store, href: "/stores" },
  // { id: "tags", label: "Tags", icon: Tag, href: "/tags" },
  { id: "customers", label: "Customers", icon: Users, href: "/customers" },
  { id: "analytics", label: "Analytics", icon: ChartColumn, href: "/analytics" },
] as const;

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await signOut();
    router.push("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-mirour-dark/95 backdrop-blur-md text-primary-foreground sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <Link href="/myflows">
                <img
                  src={logoWordmark.src}
                  alt="Mirour"
                  className="h-6 brightness-0 invert"
                />
              </Link>
            </div>

            {/* Centre pill nav — desktop only */}
            <nav className="hidden md:flex items-center  rounded-full p-1 gap-0.5">
              {NAV_TABS.filter(
                (tab) => profile?.role !== "staff" || tab.id === "myflows",
              ).map((tab) => {
                const isActive =
                  pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    onClick={() =>
                      trackEvent("Navigation Tab Clicked", {
                        tabName: tab.label,
                        location: "Desktop Header",
                      })
                    }
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? "bg-white text-mirour-dark shadow-md"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: avatar / menu button */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-white/20 transition-all"
                title="Menu"
              >
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                  {profile?.business_logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.business_logo}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <span className="hidden sm:inline text-white/80 text-xs">
                  Menu
                </span>
                <Menu className="w-3.5 h-3.5 text-white/60" />
              </button>

              {isMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-11 w-60 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden z-50">
                    {/* Mobile-only nav tabs */}
                    <div className="md:hidden">
                      {NAV_TABS.filter(
                        (tab) =>
                          profile?.role !== "staff" || tab.id === "myflows",
                      ).map((tab) => {
                        const Icon = tab.icon;
                        const isActive =
                          pathname === tab.href ||
                          pathname.startsWith(`${tab.href}/`);
                        return (
                          <Link
                            key={tab.id}
                            href={tab.href}
                            onClick={() => {
                              trackEvent("Navigation Tab Clicked", {
                                tabName: tab.label,
                                location: "Mobile Menu",
                              });
                              setIsMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {tab.label}
                          </Link>
                        );
                      })}
                      <div className="border-t border-border" />
                    </div>

                    {profile?.role !== "staff" && (
                      <Link
                        href="/myflows?create=true"
                        onClick={() => {
                          trackEvent("Create Flow Start Clicked", {
                            location: "Mobile Menu",
                          });
                          setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-foreground hover:bg-muted transition-colors"
                      >
                        <PlusCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        Create Flow
                      </Link>
                    )}

                    <Link
                      href="/profile"
                      onClick={() => {
                        trackEvent("Navigation Tab Clicked", {
                          tabName: "Profile",
                          location: "Mobile Menu",
                        });
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-foreground hover:bg-muted transition-colors"
                    >
                      <User className="w-4 h-4 text-primary flex-shrink-0" />
                      Profile
                    </Link>

                    <button
                      onClick={() => {
                        window.open(
                          "mailto:hello@mirourmirour.com?subject=Feedback",
                          "_blank",
                        );
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-foreground hover:bg-muted transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                      Give us feedback
                    </button>

                    <div className="border-t border-border" />

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <main className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-10">
        <div className="animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
