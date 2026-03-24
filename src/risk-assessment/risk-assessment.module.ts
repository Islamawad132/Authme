import { Module } from '@nestjs/common';
import { RiskAssessmentService } from './risk-assessment.service.js';
import { RiskAssessmentController } from './risk-assessment.controller.js';
import { ImpossibleTravelService } from './impossible-travel.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [RiskAssessmentService, ImpossibleTravelService],
  controllers: [RiskAssessmentController],
  exports: [RiskAssessmentService],
})
export class RiskAssessmentModule {}
