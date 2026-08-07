import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthUserPayload } from '../../common/decorators';



@Injectable()

export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(config: ConfigService) {

    super({

      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',

    });

  }



  validate(payload: AuthUserPayload) {

    return payload;

  }

}


