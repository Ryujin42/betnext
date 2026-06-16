import { IsString, Length } from 'class-validator';

export class RefreshDto {
  /**
   * Refresh token opaque (32 bytes base64url ≈ 43 chars). Hashé SHA-256
   * côté serveur pour lookup dans `sessions.refresh_token_hash`.
   */
  @IsString()
  @Length(20, 256)
  refreshToken!: string;
}
