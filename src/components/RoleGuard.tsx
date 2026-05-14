import type { PropsWithChildren } from 'react';
import type { ReactNode } from 'react';
import type { Role, Usuario } from '../types/entities';

interface RoleGuardProps extends PropsWithChildren {
  user: Usuario | undefined;
  allow: Role[];
  fallback?: ReactNode;
}

export function RoleGuard({ user, allow, fallback = null, children }: RoleGuardProps) {
  if (!user || !allow.includes(user.Rol)) return <>{fallback}</>;
  return <>{children}</>;
}
