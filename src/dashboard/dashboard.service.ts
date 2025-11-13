import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Condition, Status } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: DatabaseService) {}

  async dashboard(empId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { ID: empId },
      select: { ID: true, CURRENT_DPT_ID: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const departmentFilter = {
      employee: { CURRENT_DPT_ID: employee.CURRENT_DPT_ID },
    };

    const [
      totalAssets,
      availableAssets,
      assignedAssets,
      maintenanceAssets,
      repairAsset,
      employees,
      activeUsers,
      recentItems,
    ] = await Promise.all([
      // total assets
      this.prisma.items.count({
        where: { ...departmentFilter },
      }),

      // available assets
      this.prisma.items.count({
        where: {
          QUANTITY: { gt: 0 },
          condition: Condition.EXCELLENT,
          ...departmentFilter,
        },
      }),

      // assigned assets
      this.prisma.transaction.count({
        where: {
          status: Status.APPROVED,
          ...departmentFilter,
        },
      }),

      // maintenance assets
      this.prisma.items.count({
        where: {
          condition: Condition.MAINTENANCE,
          ...departmentFilter,
        },
      }),

      // repair assets
      this.prisma.items.count({
        where: {
          condition: Condition.REPAIR,
          ...departmentFilter,
        },
      }),

      // employees
      this.prisma.employee.count({
        where: {
          CURRENT_DPT_ID: employee.CURRENT_DPT_ID,
          DELETED: 0,
        },
      }),

      // active users
      this.prisma.users.count({
        where: {
          ...departmentFilter,
          is_active: 1,
        },
      }),

      // recent items
      this.prisma.items.findMany({
        where: { ...departmentFilter },
        select: { ID: true, ITEM_NAME: true },
        orderBy: { ID: 'desc' },
        take: 5, // optional: limit for recent display
      }),
    ]);

    return {
      recentItems,
      activeUsers,
      employees,
      repairAsset,
      maintenanceAssets,
      assignedAssets,
      availableAssets,
      totalAssets,
    };
  }
}
