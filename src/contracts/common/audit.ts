import { SoldierId } from './ids'
import { Timestamp, Version } from './scalars'

// Audit block of mutable reference entities (D-017). Spread into z.object shapes.

export const createdColumns = {
  created_at: Timestamp,
  created_by: SoldierId.nullable(),
}

export const updatedColumns = {
  updated_at: Timestamp,
  updated_by: SoldierId.nullable(),
  version: Version,
}

export const auditColumns = {
  ...createdColumns,
  ...updatedColumns,
  archived_at: Timestamp.nullable(),
}
