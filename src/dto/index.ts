export class User {
  username: string | null;
  id: number;
  role: number;
  emp_id: number;
  email: string | null;
  DEPARTMENT_USER: number | null;
  is_active: number | null;
}

export interface Items {
  ID: number;
  ITEM_NAME: string;
  DESCRIPTION: string;
  UNIT_VALUE: string;
  STOCK_QUANTITY: number;
  ORIGINAL_QUANTITY: number;
  RECEIVED_AT: string;
  PIS_NO: string;
  PROP_NO: string;
  MR_NO: string;
  ACCOUNT_code: number; // account code id FOREIGN KEY
  ADDED_BY: number; // EMPLOYEE ID FOREIGN KEY
  ICS_NO: number;
}
