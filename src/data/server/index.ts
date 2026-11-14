// The server entry of the DATA layer (D-201), for the server function only: the command gateway
// over Postgres and its HTTP handler. Driver-free (the function supplies the connection) and free
// of browser code, so the function's module graph holds no IndexedDB or DOM. The app's layers
// import the data layer through `src/data/index.ts`, never through this file.
export { CATALOG_QUERY, catalogOf, type SqlClient, type SqlParameter, type StoreCatalog } from './postgresStore'
export { createCommandGateway, GatewayRequest, type GatewayDependencies, type GatewayResponse, type Transact } from './gateway'
export { onceRetrying } from './once'
export { createCommandHandler, type CommandHandlerDependencies } from './http'
export { AuthServerUnavailable, supabaseTokenVerifier, type SupabaseAuthServer } from './supabaseIdentity'
export { createPushDispatch, type CommittedCall, type PushDevice, type PushDispatchDependencies, type PushSender } from './push'
