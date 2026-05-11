// src/lib/permissions.js

/**
 * Safely parses the permissions string or object from the database.
 */
export const parsePermissions = (permissionsData) => {
  if (!permissionsData) return {};
  if (typeof permissionsData === 'object') return permissionsData;
  try {
    return JSON.parse(permissionsData);
  } catch (error) {
    console.error("Failed to parse permissions:", error);
    return {};
  }
};

/**
 * The ultimate gatekeeper function.
 * Checks if a specific feature and mode (read/write) is allowed.
 * * @param {Object|String} userPermissions - The permissions object/string from the user's session
 * @param {String} featureId - The ID of the feature (e.g., 'edit_attendance')
 * @param {String} mode - 'read' or 'write' (defaults to 'read')
 * @returns {Boolean}
 */
export const hasAccess = (userPermissions, featureId, mode = 'read') => {
  const permissions = parsePermissions(userPermissions);
  
  // If the feature isn't defined in their permissions, deny access by default
  if (!permissions[featureId]) return false;

  // Return the specific read/write boolean
  return !!permissions[featureId][mode];
};

/**
 * Helper strictly for checking Read access (routing, hiding tabs)
 */
export const canRead = (userPermissions, featureId) => {
  return hasAccess(userPermissions, featureId, 'read');
};

/**
 * Helper strictly for checking Write access (buttons, forms, actions)
 */
export const canWrite = (userPermissions, featureId) => {
  return hasAccess(userPermissions, featureId, 'write');
};