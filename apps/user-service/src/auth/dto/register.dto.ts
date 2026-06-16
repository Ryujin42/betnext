import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Equals } from 'class-validator';

/**
 * Payload de `POST /auth/register` (cf. BETNEXT_TASKS T2.2).
 *
 * Les CGU et la politique jeu responsable doivent être acceptées
 * explicitement (`acceptTos = true`) — exigence ARJEL.
 */
export class RegisterDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Mot de passe en clair — haché en Argon2id côté service, jamais persisté. */
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une majuscule.' })
  @Matches(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une minuscule.' })
  @Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre.' })
  password!: string;

  /** Date de naissance ISO `YYYY-MM-DD` — l'âge ≥ 18 est vérifié côté service. */
  @IsDateString({ strict: true })
  birthDate!: string;

  /** Acceptation explicite des CGU + politique jeu responsable. */
  @Type(() => Boolean)
  @IsBoolean()
  @Equals(true, { message: 'Les CGU et la politique jeu responsable doivent être acceptées.' })
  acceptTos!: boolean;
}
