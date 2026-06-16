import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BetNextErrorCode, type IUser } from '@betnext/shared-types';
import { BetNextException } from '../common/exceptions/betnext.exception';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async findById(id: number): Promise<IUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new BetNextException(
        BetNextErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'Utilisateur introuvable.',
      );
    }
    return user.toPublic();
  }
}
