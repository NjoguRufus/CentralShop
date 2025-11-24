/**
 * Generate custom employee ID based on role
 * Format:
 * - Cashier: CSH-00-{numbers}
 * - Stock Manager: MNG-00-{numbers}
 * - Admin: ADM-00, ADM-01, ADM-02, etc.
 */

export interface EmployeeIdInfo {
  customId: string;
  sequenceNumber: number;
}

/**
 * Generate custom employee ID
 * @param role - Employee role
 * @param existingIds - Array of existing custom IDs to find next sequence number
 * @returns Custom employee ID and sequence number
 */
export function generateEmployeeId(
  role: 'Cashier' | 'Stock Manager' | 'Admin' | 'mainAdmin',
  existingIds: string[] = []
): EmployeeIdInfo {
  let prefix: string;
  let basePrefix: string;

  switch (role) {
    case 'Cashier':
      prefix = 'CSH-00-';
      basePrefix = 'CSH-00-';
      break;
    case 'Stock Manager':
      prefix = 'MNG-00-';
      basePrefix = 'MNG-00-';
      break;
    case 'Admin':
    case 'mainAdmin':
      prefix = 'ADM-';
      basePrefix = 'ADM-';
      break;
    default:
      prefix = 'EMP-00-';
      basePrefix = 'EMP-00-';
  }

  // Extract existing sequence numbers for this role
  const existingSequences = existingIds
    .filter(id => id.startsWith(basePrefix))
    .map(id => {
      if (role === 'Admin' || role === 'mainAdmin') {
        // For Admin: ADM-00, ADM-01, etc.
        const match = id.match(/^ADM-(\d+)$/);
        return match ? parseInt(match[1], 10) : -1;
      } else {
        // For Cashier/Manager: CSH-00-123, MNG-00-456, etc.
        const match = id.match(new RegExp(`^${basePrefix}(\\d+)$`));
        return match ? parseInt(match[1], 10) : -1;
      }
    })
    .filter(num => num >= 0);

  // Find next sequence number
  let nextSequence = 0;
  if (existingSequences.length > 0) {
    const maxSequence = Math.max(...existingSequences);
    nextSequence = maxSequence + 1;
  }

  // Format the ID
  let customId: string;
  if (role === 'Admin' || role === 'mainAdmin') {
    // Admin format: ADM-00, ADM-01, ADM-02, etc.
    customId = `ADM-${nextSequence.toString().padStart(2, '0')}`;
  } else {
    // Cashier/Manager format: CSH-00-001, MNG-00-002, etc.
    customId = `${prefix}${nextSequence.toString().padStart(3, '0')}`;
  }

  return {
    customId,
    sequenceNumber: nextSequence
  };
}

