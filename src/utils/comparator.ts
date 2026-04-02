/**
 * Sintenel Differential Analysis Engine (Comparison Utility)
 * Programmatically identifies unauthorized elements against the Golden Image README.
 */
export type ReconPayload = {
  Users: Array<{ name: string; uid: string | number }>;
  Admins: string[];
  InsecureServices?: string[];
  ProhibitedFiles?: string[];
  [key: string]: any;
};

export type AuthorizedState = {
  authorizedUsers: string[];
  authorizedAdmins: string[];
  authorizedServices: string[];
};

export interface DifferentialReport {
  unauthorizedUsers: string[];
  unauthorizedAdmins: string[];
  unauthorizedServices: string[];
  prohibitedFilesFound: string[];
}

export function compareSystemState(
  actual: ReconPayload,
  authorized: AuthorizedState
): DifferentialReport {
  const unauthorizedUsers = (actual.Users || [])
    .map((u) => u.name)
    .filter(
      (name) =>
        !authorized.authorizedUsers.includes(name) &&
        !isSystemUser(name)
    );

  const unauthorizedAdmins = (actual.Admins || []).filter(
    (name) =>
      !authorized.authorizedAdmins.includes(name) &&
      !isSystemAdmin(name)
  );

  const unauthorizedServices = (actual.InsecureServices || []).filter(
    (svc) => !authorized.authorizedServices.includes(svc)
  );

  const prohibitedFilesFound = actual.ProhibitedFiles || [];

  return {
    unauthorizedUsers,
    unauthorizedAdmins,
    unauthorizedServices,
    prohibitedFilesFound,
  };
}

/** Standard system accounts that are always authorized (Linux/Windows) */
function isSystemUser(name: string): boolean {
  const systemUsers = [
    'root', 'bin', 'daemon', 'sys', 'sync', 'games', 'man', 'lp', 'mail', 
    'news', 'uucp', 'proxy', 'www-data', 'backup', 'list', 'irc', 'gnats', 
    'nobody', '_apt', 'systemd-network', 'systemd-resolve', 'messagebus',
    'Administrator', 'Guest', 'DefaultAccount', 'WDAGUtilityAccount'
  ];
  return systemUsers.includes(name);
}

function isSystemAdmin(name: string): boolean {
  const systemAdmins = ['root', 'Administrator'];
  return systemAdmins.includes(name);
}
