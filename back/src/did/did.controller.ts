import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { DidService } from './did.service';

/**
 * DID管理用RESTコントローラー
 * DID:ETHR:Sepolia向けのCRUD操作エンドポイントを提供
 */
@Controller('did')
export class DidController {
  constructor(private readonly didService: DidService) {}

  /**
   * 公開鍵からDIDを登録
   * @param body - 公開鍵とユーザーIDを含むリクエストボディ
   * @returns 登録されたDID情報
   */
  @Post('register')
  async registerDid(
    @Body() body: { publicKey: string; userId?: string }
  ) {
    return await this.didService.registerDid();
  }

  /**
   * DIDに属性を追加
   * @param body - DID、属性名、属性値を含むリクエストボディ
   * @returns 操作結果
   */
  @Post('attributes')
  async addAttribute(
    @Body() body: { did: string; attributeName: string; attributeValue: string }
  ) {
    return await this.didService.addAttribute(body.did, body.attributeName, body.attributeValue);
  }

  /**
   * DIDから属性を削除
   * @param body - DIDと削除する属性名を含むリクエストボディ
   * @returns 操作結果
   */
  @Delete('attributes')
  async removeAttribute(
    @Body() body: { did: string; attributeName: string }
  ) {
    return await this.didService.removeAttribute(body.did, body.attributeName);
  }

  /**
   * DIDを削除（無効化）
   * @param body - 削除するDIDを含むリクエストボディ
   * @returns 操作結果
   */
  @Delete()
  async deleteDid(
    @Body() body: { did: string }
  ) {
    return await this.didService.deleteDid(body.did);
  }

  /**
   * DIDを解決してドキュメントを取得
   * @param did - 解決するDID識別子
   * @returns DIDドキュメント
   */
  @Get(':did')
  async resolveDid(@Param('did') did: string) {
    return await this.didService.resolveDid(did);
  }
}