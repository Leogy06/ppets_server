import { Controller, Get } from '@nestjs/common';
import { EmployeeService } from './employee.service';

@Controller('api/employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  async findAll() {
    return await this.employeeService.findAll();
  }
}
