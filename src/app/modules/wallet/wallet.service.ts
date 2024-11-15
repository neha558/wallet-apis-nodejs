import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common/exceptions';
import { DatabaseService } from 'src/app/database/database.service';
import { ThirdPartyApisService } from 'src/app/third-party-apis/third-party-apis.service';
import { Web3Service } from 'src/app/web3/web3.service';
import { Config } from 'src/models/config.entity';
import { NFTAirdropDailyReport } from 'src/models/nftAirdrop.entity';
import { Transaction } from 'src/models/transactions.entity';
import { User } from 'src/models/users.entity';
import { WithdrawRequest } from 'src/models/withdrawRequests.entity';
import { IsNull, MoreThanOrEqual, Not, Raw } from 'typeorm';
import * as moment from 'moment';
import { USDTTransaction } from 'src/models/usdt_transactions.entity';

const perNFTTokenForAirdrop = 2;
@Injectable()
export class WalletService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly web3Service: Web3Service,
    private readonly thirdPartyApisService: ThirdPartyApisService,
  ) {}

  async withdraw(data, user) {
    const stats = await this.mine(user);

    const available = (stats?.available ?? 0) - (stats.withdrawInprogress ?? 0);

    if (data?.amount > available) {
      throw new BadRequestException(
        `You only have ${available} tokens to withdraw, if you have already withdraw please wait for in progress transaction to be completed.`,
      );
    }

    const datasource = await this.databaseService.getDataSource();

    const wallet_withdrawal_fee_percentage = await datasource.manager
      .getRepository(Config)
      .findOne({
        where: {
          name: 'wallet_withdrawal_fee_percentage',
        },
      });

    const feeToConsider =
      parseFloat(data?.amount) *
      (parseFloat(wallet_withdrawal_fee_percentage?.value || '0') / 100);

    const saved = await datasource.manager.getRepository(Transaction).save({
      accountAddress: user?.accountAddress,
      amount: data?.amount,
      description: '',
      status: 'inprogress',
      operation: 'withdraw',
      toAccountAddress: data?.toAccountAddress,
      systemFee: feeToConsider,
    });

    // await this.web3Service.withdrawCubixToContract(
    //   data?.toAccountAddress ?? saved?.accountAddress,
    //   String(amountToConsider),
    //   saved?.id,
    // );
    return saved;
  }

  async deposit(data, user) {
    const datasource = await this.databaseService.getDataSource();

    const isAdmin = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
        role: 'admin',
        status: 'active',
      },
    });

    if (!isAdmin?.id) {
      throw new UnauthorizedException();
    }

    const saved = await datasource.manager.getRepository(Transaction).save({
      accountAddress: data?.accountAddress,
      amount: data?.amount,
      description: data?.description,
      status: 'success',
      operation: 'deposit',
    });
    return saved;
  }

  async deductUSDT(data, user) {
    const datasource = await this.databaseService.getDataSource();

    const isAdmin = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
        role: 'admin',
        status: 'active',
      },
    });

    if (!isAdmin?.id) {
      throw new UnauthorizedException();
    }

    const saved = await datasource.manager.getRepository(USDTTransaction).save({
      accountAddress: data?.accountAddress,
      amount: data?.amount,
      description: data?.description || 'Direct deduct',
      status: 'success',
      operation: 'deduct',
    });

    const userDetails = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: data?.accountAddress,
      },
    });

    await datasource.manager.getRepository(User).update(
      {
        accountAddress: data?.accountAddress,
      },
      {
        totalUSDTBalance: userDetails?.totalUSDTBalance ?? 0 - data?.amount,
      },
    );

    return saved;
  }

  async deduct(data, user) {
    const datasource = await this.databaseService.getDataSource();

    const isAdmin = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
        role: 'admin',
        status: 'active',
      },
    });

    if (!isAdmin?.id) {
      throw new UnauthorizedException();
    }

    const saved = await datasource.manager.getRepository(Transaction).save({
      accountAddress: data?.accountAddress,
      amount: data?.amount,
      description: data?.description || 'Direct deduct',
      status: 'success',
      operation: 'deduct',
    });

    return saved;
  }

  async withdrawRequest(data, user) {
    const datasource = await this.databaseService.getDataSource();
    const saved = await datasource.manager.getRepository(WithdrawRequest).save({
      accountAddress: user?.accountAddress,
      amount: data?.amount,
      description: '',
    });
    return saved;
  }

  async getWithdrawRequest(data) {
    const datasource = await this.databaseService.getDataSource();
    const [records, total] = await datasource.manager
      .getRepository(Transaction)
      .findAndCount({
        where: {
          status: data?.status,
          operation: 'withdraw',
          toAccountAddress: Not(IsNull()),
        },
      });
    return {
      records,
      total,
    };
  }

  async updateTx() {
    await this.web3Service.updateTx();
  }

  async mine(user) {
    const datasource = await this.databaseService.getDataSource();
    const userDetails = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
      },
    });

    const data = await Promise.all([
      datasource.manager
        .getRepository(Transaction)
        .query(
          `SELECT SUM(amount) as deposited FROM module_web3_wallet_transactions WHERE LOWER(account_address)='${user?.accountAddress?.toLowerCase()}' AND operation='deposit' AND status='success'`,
        ),
      datasource.manager
        .getRepository(Transaction)
        .query(
          `SELECT SUM(amount) as withdraw FROM module_web3_wallet_transactions WHERE LOWER(account_address)='${user?.accountAddress?.toLowerCase()}' AND (operation='withdraw' OR operation='deduct') AND status='success'`,
        ),
      datasource.manager
        .getRepository(Transaction)
        .query(
          `SELECT SUM(amount) as withdraw FROM module_web3_wallet_transactions WHERE LOWER(account_address)='${user?.accountAddress?.toLowerCase()}' AND (operation='withdraw' OR operation='deduct') AND status='inprogress'`,
        ),
    ]);
    const deposit = data?.[0]?.[0]?.deposited ?? 0;
    const withdraw = data?.[1]?.[0]?.withdraw ?? 0;
    const withdrawInprogress = data?.[2]?.[0]?.withdraw ?? 0;

    return {
      deposit,
      withdraw,
      withdrawInprogress,
      available: deposit - withdraw,
      walletAddress: userDetails?.walletAddress
        ? Web3Service.web3.utils.toChecksumAddress(userDetails?.walletAddress)
        : null,
    };
  }

  async transactions(user, query) {
    const datasource = await this.databaseService.getDataSource();
    const [records, total] = await datasource.manager
      .getRepository(Transaction)
      .findAndCount({
        where: {
          accountAddress: user?.accountAddress,
        },
        order: {
          createDateTime: 'desc',
        },
        ...query,
      });

    return { records, total };
  }

  async updateConfig(data, user) {
    const datasource = await this.databaseService.getDataSource();

    const isAdmin = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
        role: 'admin',
        status: 'active',
      },
    });

    if (!isAdmin?.id) {
      throw new UnauthorizedException();
    }

    const saved = await datasource.manager.getRepository(Config).findOne({
      where: {
        name: data?.name,
      },
    });

    await datasource.manager.getRepository(Config).save({
      id: saved?.id,
      name: data?.name,
      value: data?.value,
    });

    return true;
  }

  async getConfig(data) {
    const datasource = await this.databaseService.getDataSource();
    const saved = await datasource.manager.getRepository(Config).findOne({
      where: {
        name: data?.name,
      },
    });

    return {
      name: saved?.name,
      value: saved?.value,
    };
  }

  async multipleTx(data, user) {
    const datasource = await this.databaseService.getDataSource();

    const isAdmin = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
        role: 'admin',
        status: 'active',
      },
    });

    if (!isAdmin?.id) {
      throw new UnauthorizedException();
    }

    const saved = await datasource.manager.getRepository(Transaction).save(
      data.map((_data) => {
        return {
          accountAddress: _data?.accountAddress,
          amount: _data?.amount,
          description: _data?.description || 'Direct deduct',
          status: 'success',
          operation: _data?.operation,
        };
      }),
    );

    return saved;
  }

  async deLinkWalletViaAdmin(data, user) {
    const datasource = await this.databaseService.getDataSource();

    const isAdmin = await datasource.manager.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
        role: 'admin',
        status: 'active',
      },
    });

    if (!isAdmin?.id) {
      throw new UnauthorizedException();
    }

    const saved = await datasource.manager.getRepository(User).update(
      {
        ...data,
      },
      {
        walletAddress: null,
      },
    );
    return saved;
  }

  async getNFTAirdropDailyReportHistory(user, query) {
    const datasource = await this.databaseService.getDataSource();
    const userDetails = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
      },
    });

    const [data, total] = await datasource
      .getRepository(NFTAirdropDailyReport)
      .findAndCount({
        select: [
          'accountAddress',
          'totalNFTs',
          'tokens',
          'claimedBefore',
          'status',
          'id',
          'createDateTime',
        ],
        where: {
          user: {
            id: userDetails?.id,
          },
          status: 'claimed',
        },
        ...query,
        take: parseInt(query?.take ?? 10),
        skip: parseInt(query?.skip ?? 0),
        order: {
          createDateTime: 'desc',
        },
      });

    return { data, total };
  }

  async getNFTAirdropDailyReport(user) {
    const datasource = await this.databaseService.getDataSource();
    const userDetails = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
      },
    });

    const todayEOD = moment().endOf('date').format();

    let exists = await datasource.getRepository(NFTAirdropDailyReport).findOne({
      select: [
        'accountAddress',
        'totalNFTs',
        'tokens',
        'claimedBefore',
        'status',
        'id',
      ],
      where: {
        user: { id: userDetails?.id },
      },
      order: {
        id: 'DESC',
      },
    });

    if (exists?.id) {
      const claimTimeGone = moment(exists?.claimedBefore).isBefore(moment());
      if (claimTimeGone) {
        exists = null;
      }
    }

    const totalEarnings = await datasource
      .getRepository(NFTAirdropDailyReport)
      .query(
        `SELECT SUM(tokens) as sum from module_web3_wallet_nft_airdrop_daily_report WHERE userId='${userDetails.id}' AND status='claimed'`,
      );

    if (exists) {
      return { ...exists, totalEarnings: totalEarnings?.[0]?.sum || 0 };
    }

    const emailOfUserResult = await datasource
      .getRepository(NFTAirdropDailyReport)
      .query(`SELECT email from user WHERE id='${userDetails._id}'`);

    const emailOfUser = emailOfUserResult?.[0]?.email;

    const accountsBasedOnEmail = await datasource
      .getRepository(NFTAirdropDailyReport)
      .query(
        `SELECT account_address from module_networking_users WHERE email='${emailOfUser}'`,
      );

    // in web wallet as well now we can have multiple account based on _id
    const allWeb3WalletUsers = await datasource.getRepository(User).find({
      select: ['accountAddress', 'walletAddress'],
      where: {
        _id: userDetails._id,
      },
    });

    const accountSet = [
      ...new Set(
        [
          ...(accountsBasedOnEmail?.map((a) => a?.account_address) ?? []),
          ...(allWeb3WalletUsers?.map((a) => a?.accountAddress) ?? []),
          ...(allWeb3WalletUsers?.map((a) => a?.walletAddress) ?? []),
        ].map((_d) => _d?.toLowerCase()),
      ),
    ].filter((a) => a);

    // check for today is data exists
    let totalNFTs = 0;

    for (const accountAddress of accountSet) {
      const nftCount = await this.web3Service.getTotalNFTs(accountAddress);
      totalNFTs = totalNFTs + nftCount;
    }

    if (totalNFTs <= 0) {
      throw new BadRequestException('NFTs not found for given account');
    }

    const saved = await datasource.getRepository(NFTAirdropDailyReport).save({
      accountAddress: String(
        userDetails?.walletAddress ?? userDetails?.accountAddress,
      ).toLowerCase(),
      claimedBefore: todayEOD,
      totalNFTs,
      tokens: perNFTTokenForAirdrop * totalNFTs,
      status: 'pending',
      uniqueKey: `${userDetails?.id}_${todayEOD.toString()}`,
      user: userDetails,
    });

    return {
      accountAddress: saved?.accountAddress,
      totalNFTs: saved?.totalNFTs,
      tokens: saved?.tokens,
      claimedBefore: saved?.claimedBefore,
      status: saved?.status,
      id: saved?.id,
      totalEarnings: totalEarnings?.[0]?.sum || 0,
    };
  }

  async claimNFTAirdrop(user) {
    const datasource = await this.databaseService.getDataSource();
    const userDetails = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: user?.accountAddress,
      },
    });

    const now = new Date();

    const valid = await datasource
      .getRepository(NFTAirdropDailyReport)
      .findOne({
        select: [
          'accountAddress',
          'totalNFTs',
          'tokens',
          'claimedBefore',
          'status',
          'id',
        ],
        where: {
          user: { id: userDetails?.id },
          claimedBefore: MoreThanOrEqual(now),
          status: 'pending',
        },
      });

    if (!valid?.id) {
      throw new BadRequestException(
        'No tokens found to claim for your address for today',
      );
    }

    await datasource.getRepository(NFTAirdropDailyReport).update(
      {
        id: valid?.id,
      },
      {
        status: 'claimed',
        claimedBefore: valid?.claimedBefore,
      },
    );

    const saved = await datasource.manager.getRepository(Transaction).save({
      accountAddress: userDetails?.accountAddress,
      amount: String(valid?.tokens),
      description: `Airdrop | ${valid?.totalNFTs} | ${valid?.tokens}`,
      status: 'success',
      operation: 'deposit',
    });

    await this.thirdPartyApisService.addTx({
      userId: userDetails?._id,
      accountAddress: userDetails?.accountAddress,
      transaction_amount: String(valid?.tokens),
      transaction_id: saved?.id,
      transaction_type: 'Credit',
      message: 'Airdrop claim token',
    });

    return true;
  }

  async getNFTAirdropDailyReportHistoryBasedOnAccount(user, query) {
    if (!query?.accountAddress) {
      throw new BadRequestException(
        'Not valid request, provide accountAddress',
      );
    }
    const datasource = await this.databaseService.getDataSource();

    const loggedInUser = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: Raw(
          (alias) =>
            `LOWER(${alias}) = '${String(user?.accountAddress).toLowerCase()}'`,
        ),
      },
    });

    const [data, total] = await datasource
      .getRepository(NFTAirdropDailyReport)
      .findAndCount({
        select: [
          'accountAddress',
          'totalNFTs',
          'tokens',
          'claimedBefore',
          'status',
          'id',
          'createDateTime',
        ],
        where: {
          accountAddress: Raw(
            (alias) =>
              `LOWER(${alias}) = '${String(
                query?.accountAddress,
              ).toLowerCase()}'`,
          ),
          user: { id: loggedInUser?.id },
          status: 'claimed',
        },
        ...query,
        take: parseInt(query?.take ?? 10),
        skip: parseInt(query?.skip ?? 0),
        order: {
          createDateTime: 'desc',
        },
      });

    return { data, total };
  }

  async getNFTAirdropDailyReportBasedOnAccount(user, data) {
    if (!data?.accountAddress) {
      throw new BadRequestException(
        'Not valid request, provide accountAddress',
      );
    }
    const datasource = await this.databaseService.getDataSource();
    const loggedInUser = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: Raw(
          (alias) =>
            `LOWER(${alias}) = '${String(user?.accountAddress).toLowerCase()}'`,
        ),
      },
    });

    const givenAccountAddress = await datasource.getRepository(User).findOne({
      where: [
        {
          accountAddress: Raw(
            (alias) =>
              `LOWER(${alias}) = '${String(
                data?.accountAddress,
              ).toLowerCase()}'`,
          ),
        },
        {
          walletAddress: Raw(
            (alias) =>
              `LOWER(${alias}) = '${String(
                data?.accountAddress,
              ).toLowerCase()}'`,
          ),
        },
      ],
    });

    const loggedInMainUserId = loggedInUser?._id;
    const givenAccountAddressMainUserId = givenAccountAddress?._id;

    if (String(loggedInMainUserId) !== String(givenAccountAddressMainUserId)) {
      throw new UnauthorizedException('Invalid user account credentials');
    }

    const todayEOD = moment().endOf('date').format();
    let exists = await datasource.getRepository(NFTAirdropDailyReport).findOne({
      select: [
        'accountAddress',
        'totalNFTs',
        'tokens',
        'claimedBefore',
        'status',
        'id',
      ],
      where: {
        accountAddress: Raw(
          (alias) =>
            `LOWER(${alias}) = '${String(data?.accountAddress).toLowerCase()}'`,
        ),
      },
      order: {
        id: 'DESC',
      },
    });

    if (exists?.id) {
      const claimTimeGone = moment(exists?.claimedBefore).isBefore(moment());
      if (claimTimeGone) {
        exists = null;
      }
    }

    const totalEarnings = await datasource
      .getRepository(NFTAirdropDailyReport)
      .query(
        `SELECT SUM(tokens) as sum from module_web3_wallet_nft_airdrop_daily_report WHERE LOWER(account_address)='${data?.accountAddress?.toLowerCase()}' AND status='claimed' AND userId='${
          loggedInUser?.id
        }'`,
      );

    if (exists) {
      return { ...exists, totalEarnings: totalEarnings?.[0]?.sum || 0 };
    }

    // check for today is data exists
    const totalNFTs = await this.web3Service.getTotalNFTs(data?.accountAddress);
    if (totalNFTs <= 0) {
      throw new BadRequestException('NFTs not found for given account');
    }

    const saved = await datasource.getRepository(NFTAirdropDailyReport).save({
      accountAddress: String(data?.accountAddress).toLowerCase(),
      claimedBefore: todayEOD,
      totalNFTs,
      tokens: perNFTTokenForAirdrop * totalNFTs,
      status: 'pending',
      uniqueKey: `${data?.accountAddress}_${todayEOD.toString()}`,
      user: loggedInUser,
    });

    return {
      accountAddress: saved?.accountAddress,
      totalNFTs: saved?.totalNFTs,
      tokens: saved?.tokens,
      claimedBefore: saved?.claimedBefore,
      status: saved?.status,
      id: saved?.id,
      totalEarnings: totalEarnings?.[0]?.sum || 0,
    };
  }

  async claimNFTAirdropBasedOnAccount(user, data) {
    if (!data?.accountAddress) {
      throw new BadRequestException(
        'Not valid request, provide accountAddress',
      );
    }
    const datasource = await this.databaseService.getDataSource();
    const loggedInUser = await datasource.getRepository(User).findOne({
      where: {
        accountAddress: Raw(
          (alias) =>
            `LOWER(${alias}) = '${String(user?.accountAddress).toLowerCase()}'`,
        ),
      },
    });

    const givenAccountAddress = await datasource.getRepository(User).findOne({
      where: [
        {
          accountAddress: Raw(
            (alias) =>
              `LOWER(${alias}) = '${String(
                data?.accountAddress,
              ).toLowerCase()}'`,
          ),
        },
        {
          walletAddress: Raw(
            (alias) =>
              `LOWER(${alias}) = '${String(
                data?.accountAddress,
              ).toLowerCase()}'`,
          ),
        },
      ],
    });

    const loggedInMainUserId = loggedInUser?._id;
    const givenAccountAddressMainUserId = givenAccountAddress?._id;

    if (String(loggedInMainUserId) !== String(givenAccountAddressMainUserId)) {
      throw new UnauthorizedException('Invalid user account credentials');
    }

    const now = new Date();

    const valid = await datasource
      .getRepository(NFTAirdropDailyReport)
      .findOne({
        select: [
          'accountAddress',
          'totalNFTs',
          'tokens',
          'claimedBefore',
          'status',
          'id',
        ],
        where: {
          user: { id: loggedInUser?.id },
          accountAddress: Raw(
            (alias) =>
              `LOWER(${alias}) = '${String(
                data?.accountAddress,
              ).toLowerCase()}'`,
          ),
          claimedBefore: MoreThanOrEqual(now),
          status: 'pending',
        },
      });

    if (!valid?.id) {
      throw new BadRequestException(
        'No tokens found to claim for your address with logged in user for today',
      );
    }

    await datasource.getRepository(NFTAirdropDailyReport).update(
      {
        id: valid?.id,
      },
      {
        status: 'claimed',
        claimedBefore: valid?.claimedBefore,
      },
    );

    const saved = await datasource.manager.getRepository(Transaction).save({
      accountAddress: user?.accountAddress,
      amount: String(valid?.tokens),
      description: `Airdrop | ${valid?.totalNFTs} | ${valid?.tokens}`,
      status: 'success',
      operation: 'deposit',
    });

    await this.thirdPartyApisService.addTx({
      userId: loggedInUser?._id,
      accountAddress: data?.accountAddress,
      transaction_amount: String(valid?.tokens),
      transaction_id: saved?.id,
      transaction_type: 'Credit',
      message: 'Airdrop claim token',
    });

    return true;
  }
}

// [
//   {
//     accountAddress: '',
//     amount: 1,
//     description: '',
//     operation: 'deposit' / 'deduct' / 'withdraw'
//   }
// ]
