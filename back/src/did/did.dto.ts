/**
 * DID登録用リクエストDTO
 */
export class RegisterDidDto {
  /**
   * Ethereum公開鍵（16進数形式）
   * @example "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd"
   */
  publicKey: string;

  /**
   * ユーザー識別子（オプション）
   * 指定しない場合はランダムナンスを使用
   * @example "user123"
   */
  userId?: string;
}

/**
 * DID属性追加用リクエストDTO
 */
export class AddAttributeDto {
  /**
   * DID識別子
   * @example "did:ethr:sepolia:0x742d35Cc6634C0532925a3b8D4C9db96590b5b4e"
   */
  did: string;

  /**
   * 属性名
   * @example "did/pub/secp256k1/veriKey"
   */
  attributeName: string;

  /**
   * 属性値
   * @example "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd"
   */
  attributeValue: string;
}

/**
 * DID属性削除用リクエストDTO
 */
export class RemoveAttributeDto {
  /**
   * DID識別子
   * @example "did:ethr:sepolia:0x742d35Cc6634C0532925a3b8D4C9db96590b5b4e"
   */
  did: string;

  /**
   * 削除する属性名
   * @example "did/pub/secp256k1/veriKey"
   */
  attributeName: string;
}

/**
 * DID削除用リクエストDTO
 */
export class DeleteDidDto {
  /**
   * 削除するDID識別子
   * @example "did:ethr:sepolia:0x742d35Cc6634C0532925a3b8D4C9db96590b5b4e"
   */
  did: string;
}

/**
 * DID登録レスポンスDTO
 */
export class DidResponseDto {
  /**
   * 生成されたDID識別子
   */
  did: string;

  /**
   * Ethereumアドレス
   */
  address: string;

  /**
   * 公開鍵
   */
  publicKey: string;

  /**
   * 使用されたユーザー識別子
   */
  userId?: string;

  /**
   * トランザクションハッシュ
   */
  transactionHash?: string;

  /**
   * ブロック番号
   */
  blockNumber?: number;

  /**
   * 使用ガス量
   */
  gasUsed?: string;

  /**
   * 注意事項やメッセージ
   */
  note?: string;
}

/**
 * 操作成功レスポンスDTO
 */
export class SuccessResponseDto {
  /**
   * 操作成功フラグ
   */
  success: boolean;

  /**
   * トランザクションハッシュ
   */
  transactionHash?: string;

  /**
   * ブロック番号
   */
  blockNumber?: number;

  /**
   * 使用ガス量
   */
  gasUsed?: string;
}