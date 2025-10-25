import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { RootService } from './root.service';

/**
 * ルートモジュール
 * アプリケーションの基本エンドポイントを提供
 */
@Module({
  controllers: [RootController],
  providers: [RootService],
})
export class RootModule {}