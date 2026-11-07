import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BudgetsController } from './budgets.controller';
import { CategoryBudgetController } from './category-budget.controller';
import { CategoryBudgetService } from './category-budget.service';
import { ExpenseBudgetItemsController } from './expense-budget-items.controller';
import { ExpenseAttachmentsController } from './expense-attachments.controller';
import { ExpenseAttachmentsService } from './expense-attachments.service';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';

import { AnnualPlansController } from './annual-plans.controller';
import { AnnualPlansService } from './annual-plans.service';
import { ProjectExpensePlanController } from './project-expense-plan.controller';
import { ProjectExpensePlanService } from './project-expense-plan.service';
import { ExpenseCategoriesController } from './expense-categories.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    ExpenseAttachmentsController,
    ExpenseController,
    AnnualPlansController,
    ProjectExpensePlanController,
    CategoryBudgetController,
    BudgetsController,
    ExpenseBudgetItemsController,
    ExpenseCategoriesController,
  ],
  providers: [
    ExpenseService,
    ExpenseAttachmentsService,
    AnnualPlansService,
    ProjectExpensePlanService,
    CategoryBudgetService,
  ],
  exports: [
    ExpenseService,
    ExpenseAttachmentsService,
    AnnualPlansService,
    ProjectExpensePlanService,
    CategoryBudgetService,
  ],
})
export class ExpenseModule {}

