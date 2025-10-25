import { Module } from '@nestjs/common';
import { DidController } from './did.controller';
import { DidService } from './did.service';

/**
 * DID機能モジュール
 * DID:ETHR:Sepoliaの管理機能を提供するモジュール
 * コントローラーとサービスを統合管理
 */
@Module({
  controllers: [DidController],
  providers: [DidService],
})
export class DidModule {}