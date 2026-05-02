import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import Header from "@/components/layout/Header";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 mb-20 lg:mb-0">
          <div className="w-full lg:max-w-[960px] lg:mx-auto">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
