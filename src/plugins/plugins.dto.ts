import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PluginSummaryDto {
  @ApiProperty({ example: 'example-event-logger' })
  name!: string;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiPropertyOptional({ example: 'Logs all auth events to the console' })
  description?: string;

  @ApiProperty({
    example: 'event-listener',
    enum: ['auth-provider', 'event-listener', 'token-enrichment', 'theme'],
  })
  type!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiPropertyOptional({ example: { logLevel: 'info' } })
  config!: Record<string, any> | null;

  @ApiProperty()
  installedAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
