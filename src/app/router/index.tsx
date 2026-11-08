import { ROUTES, type RoutePath } from '@config'
import type { AuthIdentity, Session } from '@contracts'
import { useSession } from '@logic'
import {
  Navigate,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useLocation,
} from '@tanstack/react-router'
import { FailureScreen, LoadingScreen, OnboardingScreen, SignInScreen, WorkspaceScreen } from '@ui'

// One workspace route, plus sign-in and onboarding outside it (D-023). The session decides which
// one applies: a URL never gets anyone past the adapter, it only decides what to show.

function destinationOf(session: Session): RoutePath {
  if (session.status === 'signed_out') return ROUTES.signIn
  return session.status === 'unlinked' ? ROUTES.onboarding : ROUTES.workspace
}

function SessionGate() {
  const session = useSession()
  const pathname = useLocation({ select: (location) => location.pathname })
  if (session.status === 'loading') return <LoadingScreen />
  if (session.status === 'failed') return <FailureScreen error={session.error} />
  const destination = destinationOf(session.value)
  if (pathname !== destination) return <Navigate to={destination} replace />
  return <Outlet />
}

function useSignedInIdentity(): AuthIdentity | null {
  const session = useSession()
  if (session.status !== 'ready' || session.value.status === 'signed_out') return null
  return session.value.identity
}

function OnboardingRoute() {
  const identity = useSignedInIdentity()
  return identity === null ? null : <OnboardingScreen identity={identity} />
}

function WorkspaceRoute() {
  const identity = useSignedInIdentity()
  return identity === null ? null : <WorkspaceScreen identity={identity} />
}

const rootRoute = createRootRoute({ component: SessionGate })

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: ROUTES.workspace, component: WorkspaceRoute }),
  createRoute({ getParentRoute: () => rootRoute, path: ROUTES.signIn, component: SignInScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: ROUTES.onboarding, component: OnboardingRoute }),
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />
}
