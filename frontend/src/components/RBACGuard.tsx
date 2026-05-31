"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_HIERARCHY: Record<string, number> = { admin: 3, researcher: 2, viewer: 1 };

interface RBACGuardProps {
  requiredRole: "admin" | "researcher" | "viewer";
  children: React.ReactNode;
}

export default function RBACGuard({ requiredRole, children }: RBACGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role  = localStorage.getItem("user_role") ?? "";
    if (!token) {
      router.push("/login");
      return;
    }
    const hasAccess = (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 99);
    setAuthorized(hasAccess);
  }, [requiredRole, router]);

  if (authorized === null) return <div className="p-8 text-gray-400">Checking access…</div>;
  if (!authorized) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 text-lg font-semibold">Access Denied</p>
        <p className="text-gray-500 mt-1">Your role does not permit access to this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}
