import { Employee } from 'src/dto';

export const employeeName = (employee: Employee) => {
  if (!employee) return '--';

  return `${employee.FIRSTNAME} ${employee.MIDDLNAME ?? ''} ${employee.LASTNAME} ${employee.SUFFIX ?? ''}`;
};
