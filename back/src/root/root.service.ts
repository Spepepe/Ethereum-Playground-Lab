import { Injectable } from '@nestjs/common';

/**
 * ルートサービス
 * アプリケーションの基本機能を提供
 */
@Injectable()
export class RootService {
  /**
   * グリーティングメッセージを返す
   * @returns Hello Worldメッセージ
   */
  getHello(): string {
    return 'Hello World!';
  }
}