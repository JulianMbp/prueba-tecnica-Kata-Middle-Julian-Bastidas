import { Body, Controller, Post } from '@nestjs/common';
import { SendEmailDto } from '../dto/send-email.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('email')
  sendApprovalEmail(@Body() dto: SendEmailDto) {
    return this.notificationService.sendApprovalEmail(dto);
  }
}
