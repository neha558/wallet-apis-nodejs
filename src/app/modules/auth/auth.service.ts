import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common/exceptions';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from 'src/app/database/database.service';
import { Web3Service } from 'src/app/web3/web3.service';
import { User } from 'src/models/users.entity';
import { RegisterDTO } from './dto/Register.dto';
const ethUtil = require('ethereumjs-util');

const bcrypt = require('bcrypt');

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private web3Service: Web3Service,
    private readonly databaseService: DatabaseService,
  ) {}

  async me(accountAddress) {
    const datasource = await this.databaseService.getDataSource();
    const user = await datasource.getRepository(User).findOne({
      where: {
        accountAddress,
      },
    });
    return {
      _id: user?._id,
      id: user?.id,
      accountAddress: user?.accountAddress,
      walletAddress: user?.walletAddress
        ? Web3Service.web3.utils.toChecksumAddress(user?.walletAddress)
        : null,
    };
  }

  async login(body: any) {
    const datasource = await this.databaseService.getDataSource();
    const user = await datasource.getRepository(User).findOneOrFail({
      where: {
        accountAddress: body.accountAddress,
        isArchived: false,
      },
    });
    const payload = {
      accountAddress: user.accountAddress,
      id: user?.id,
      walletAddress: user?.walletAddress,
      _id: user?._id,
    };

    return this.jwtService.sign(payload);
  }

  async register(body: RegisterDTO) {
    const datasource = await this.databaseService.getDataSource();
    const accountDetails = this.web3Service.createAccount();
    const existing = await datasource.getRepository(User).findOne({
      where: {
        _id: body?._id,
        isArchived: false,
      },
    });

    if (existing?.accountAddress) {
      return {
        id: existing?.id,
        accountAddress: existing?.accountAddress,
        _id: existing?._id,
        accessToken: await this.login({
          accountAddress: existing?.accountAddress,
          id: existing?.id,
        }),
      };
    }

    const saved = await datasource.getRepository(User).save({
      accountAddress: accountDetails?.address,
      encrypted: JSON.stringify(accountDetails?.encrypted),
      _id: body?._id,
      status: 'created',
      id: existing?.id,
      nonce: Math.floor(Math.random() * 1000000),
    });

    return {
      id: saved?.id,
      accountAddress: saved?.accountAddress,
      _id: saved?._id,
      accessToken: await this.login({
        accountAddress: saved?.accountAddress,
        id: saved?.id,
      }),
    };
  }

  async test() {
    return '';
  }

  async validateUser(username: string, password: string) {
    const datasource = await this.databaseService.getDataSource();
    const saved = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: username,
        status: 'active',
        role: 'admin',
      },
    });

    if (!password || !saved?.id) {
      throw new UnauthorizedException('Not valid credentials');
    }
    if (!(await bcrypt.compare(password, saved?.password))) {
      throw new UnauthorizedException('Not valid credentials');
    }
    const payload = { accountAddress: saved?.accountAddress, id: saved?.id };

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: '60s',
      }),
    };
  }

  async requestNonce(userJWT) {
    const datasource = await this.databaseService.getDataSource();

    const user = await datasource.getRepository(User).findOneOrFail({
      where: {
        accountAddress: userJWT?.accountAddress,
      },
    });

    const nonce = Math.floor(Math.random() * 1000000);
    await datasource.getRepository(User).update({ id: user?.id }, { nonce });
    const payload = { accountAddress: user?.accountAddress, id: user?.id };

    return {
      nonce,
      accessToken: this.jwtService.sign(payload, {
        expiresIn: '180s',
      }),
    };
  }

  async validateSignature(userJWT, body) {
    const walletAddress = body?.walletAddress;
    const signature = body?.signature;

    const datasource = await this.databaseService.getDataSource();

    const walletExist = await datasource.getRepository(User).findOne({
      where: {
        walletAddress,
      },
    });

    if (walletExist?.id) {
      throw new BadRequestException(
        'Wallet address already sync with app, try another one.',
      );
    }

    const user = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: userJWT?.accountAddress,
      },
    });

    if (user?.walletAddress) {
      throw new BadRequestException(
        'Wallet address already sync with app, try another one for this user.',
      );
    }

    if (!user.nonce) {
      throw new BadRequestException('Signature verification failed');
    }

    const message = `Signing with one-time nonce for cubixpro: ${user.nonce}`;

    const msgHex = ethUtil.bufferToHex(Buffer.from(message));
    const msgBuffer = ethUtil.toBuffer(msgHex);
    const msgHash = ethUtil.hashPersonalMessage(msgBuffer);
    const signatureBuffer = ethUtil.toBuffer(signature);
    const signatureParams = ethUtil.fromRpcSig(signatureBuffer);
    const publicKey = ethUtil.ecrecover(
      msgHash,
      signatureParams.v,
      signatureParams.r,
      signatureParams.s,
    );
    const addressBuffer = ethUtil.publicToAddress(publicKey);
    const address = ethUtil.bufferToHex(addressBuffer);

    console.log({ address });

    if (address.toLowerCase() === walletAddress.toLowerCase()) {
      await datasource.getRepository(User).update(
        { id: user?.id },
        {
          walletAddress: walletAddress,
          nonce: 0,
        },
      );
      return {
        id: user?.id,
        walletAddress: user?.walletAddress,
      };
    }

    throw new BadRequestException('Signature verification failed');
  }

  async detachWalletAddress(user) {
    const datasource = await this.databaseService.getDataSource();
    await datasource.getRepository(User).update(
      { accountAddress: user?.accountAddress },
      {
        walletAddress: null,
      },
    );
  }

  async checkEmailAccount(user, body) {
    const datasource = await this.databaseService.getDataSource();
    const isAdmin = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
        status: 'active',
        role: 'admin',
      },
    });

    if (!isAdmin) {
      return new UnauthorizedException('Not an admin user');
    }

    // check email exists or not using API if exists return _id
    // or create new user and return _id by passing body
    const _id = '0';

    const existingUser = await datasource.getRepository(User).findOne({
      where: {
        _id,
      },
    });

    if (existingUser?.id) {
      return existingUser;
    }

    const newUser = await this.register({
      _id,
    });

    const userDetails = await datasource.getRepository(User).findOne({
      where: {
        id: newUser?.id,
      },
    });

    return userDetails;
  }
}
