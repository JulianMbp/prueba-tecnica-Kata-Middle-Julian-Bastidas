import { Module } from '@nestjs/common';
import { NotificationController } from './notification/notification.controller';
import { NotificationService } from './notification/notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class AppModule {}
