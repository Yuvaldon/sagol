// The only routes of the product: the workspace, and sign-in and onboarding outside it (D-023).

export const ROUTES = {
  workspace: '/',
  signIn: '/sign-in',
  onboarding: '/onboarding',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
