import { Controller, Get } from '@nestjs/common';
import { RootService } from './root.service';

/**
 * ルートコントローラー
 * アプリケーションの基本情報を提供するエンドポイント
 */
@Controller()
export class RootController {
  constructor(private readonly rootService: RootService) {}

  /**
   * アプリケーションのヘルスチェック
   * @returns グリーティングメッセージ
   */
  @Get()
  getHello(): string {
    return this.rootService.getHello();
  }
}