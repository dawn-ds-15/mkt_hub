import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';
import {
  AnonymousProfilesController,
  CompaniesController,
  LandingPagesTrackingController,
  Leads360Controller,
  PublicLeadsController,
  PublicTrackingController,
  SlaQueueController,
  TrackingSitesController,
} from './profiles.controller';
import { ProfilesSeedService } from './profiles.seed';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [PrismaModule, AuditModule, PermissionsModule],
  controllers: [
    PublicTrackingController,
    PublicLeadsController,
    AnonymousProfilesController,
    TrackingSitesController,
    LandingPagesTrackingController,
    Leads360Controller,
    CompaniesController,
    SlaQueueController,
  ],
  providers: [ProfilesService, ProfilesSeedService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
