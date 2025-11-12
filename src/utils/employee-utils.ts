import { Employee } from 'src/dto';

export const employeeName = (
  employee: Omit<Employee, 'ID' | 'CURRENT_DPT_ID'>,
) => {
  if (!employee) return '--';

  return `${employee.FIRSTNAME} ${employee.MIDDLNAME ?? ''} ${employee.LASTNAME} ${employee.SUFFIX ?? ''}`;
};
