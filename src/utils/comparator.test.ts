import { describe, it, expect } from 'vitest';
import { compareSystemState, type ReconPayload, type AuthorizedState } from './comparator.js';

describe('Differential Analysis Engine: State Comparator', () => {
  it('should identify unauthorized users and admins correctly', () => {
    const actual: ReconPayload = {
      Users: [
        { name: 'root', uid: 0 },
        { name: 'alice', uid: 1000 },
        { name: 'malicious_user', uid: 6666 },
        { name: 'bob', uid: 1001 }
      ],
      Admins: ['root', 'alice', 'malicious_user'],
      InsecureServices: ['telnet', 'ssh', 'ftp'],
      ProhibitedFiles: ['/home/alice/hack.exe']
    };

    const authorized: AuthorizedState = {
      authorizedUsers: ['alice', 'bob'],
      authorizedAdmins: ['alice'],
      authorizedServices: ['ssh']
    };

    const report = compareSystemState(actual, authorized);

    expect(report.unauthorizedUsers).toContain('malicious_user');
    expect(report.unauthorizedUsers).not.toContain('root'); // System users spared
    expect(report.unauthorizedUsers).not.toContain('alice'); // Authorized

    expect(report.unauthorizedAdmins).toContain('malicious_user');
    expect(report.unauthorizedAdmins).not.toContain('alice'); // Authorized admin

    expect(report.unauthorizedServices).toContain('telnet');
    expect(report.unauthorizedServices).toContain('ftp');
    expect(report.unauthorizedServices).not.toContain('ssh'); 

    expect(report.prohibitedFilesFound).toEqual(['/home/alice/hack.exe']);
  });

  it('should spare system accounts even if not in README', () => {
      const actual: ReconPayload = {
        Users: [{ name: 'www-data', uid: 33 }, { name: 'nobody', uid: 65534 }],
        Admins: ['root'],
        InsecureServices: []
      }
      const authorized: AuthorizedState = {
          authorizedUsers: [],
          authorizedAdmins: [] ,
          authorizedServices: []
      }
      const report = compareSystemState(actual, authorized);
      
      expect(report.unauthorizedUsers.length).toBe(0);
      expect(report.unauthorizedAdmins.length).toBe(0);
  });
});
