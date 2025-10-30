export function roleIdConvert(roleId) {
  switch (roleId) {
    case 1:
      return 'Admin';
    case 2:
      return 'Employee';

    default:
      return 'Unknown Role';
  }
}
