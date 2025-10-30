export function convertDepartmentId(deptId: number | null) {
  switch (deptId) {
    case 1:
      return "City Accountant's Office.";
    default:
      return 'Unknown Department.';
  }
}
