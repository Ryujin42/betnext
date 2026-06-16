import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /**
   * Mot de passe en clair — comparé à `users.password_hash` via Argon2id.
   * Non logué en aucun cas (filtre des champs sensibles à venir au Lot 11).
   */
  @IsString()
  @MaxLength(128)
  password!: string;
}
