import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule/dist';
import { Web3Service } from './app/web3/web3.service';
// import { dataBk } from './app/common/constants/data_bk';
import { DatabaseService } from './app/database/database.service';
import { Config } from './models/config.entity';
import { User } from './models/users.entity';
import { TokenTransactions } from './models/tokenTransactions.entity';
import { Transaction } from './models/transactions.entity';
import { NFTAirdropDailyReport } from './models/nftAirdrop.entity';
import { bkData } from './app/common/constants/back_up_data';

const chunk_inefficient = (array, chunkSize) => {
  return [].concat.apply(
    [],
    array.map(function (elem, i) {
      return i % chunkSize ? [] : [array.slice(i, i + chunkSize)];
    }),
  );
};

@Injectable()
export class AppService {
  constructor(
    private readonly web3Service: Web3Service,
    private readonly databaseService: DatabaseService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  moralisWebhook(data) {
    this.web3Service.moralisWebhook(data);
  }

  async oldData() {
    const datasource = await this.databaseService.getDataSource();

    const configs = await datasource.getRepository(Config).find();

    const nftAirdropDailyReport = await datasource
      .getRepository(NFTAirdropDailyReport)
      .find();

    const tokenTransactions = await datasource
      .getRepository(TokenTransactions)
      .find();

    const transactions = await datasource.getRepository(Transaction).find();
    const users = await datasource.getRepository(User).find();

    return {
      configs,
      nftAirdropDailyReport,
      tokenTransactions,
      transactions,
      users,
    };
  }
  async importData() {
    const users = bkData.users;
    const tokenTransactions = bkData.tokenTransactions;
    const transactions = bkData.transactions;
    const nftAirdropDailyReport = bkData.nftAirdropDailyReport;

    // const users = dataBk.users;
    // const tokenTransactions = dataBk.tokenTransactions;
    // const transactions = dataBk.transactions;
    // const nftAirdropDailyReport = dataBk.nftAirdropDailyReport;

    const dataSource = await this.databaseService.getDataSource();

    // await dataSource.getRepository(Config).save(
    //   configs.map((_configs) => {
    //     return {
    //       name: _configs.name,
    //       value: _configs.value,
    //     };
    //   }),
    // );

    for (const [index, _users] of users.entries()) {
      const exists = await dataSource.getRepository(User).findOne({
        where: [
          {
            accountAddress: _users.accountAddress,
          },
          {
            walletAddress: _users.walletAddress,
          },
        ],
      });
      console.log(`user imported ${index}`);
      if (!exists?.id) {
        await dataSource.getRepository(User).save({
          _id: _users._id,
          accountAddress: _users.accountAddress,
          encrypted: _users.encrypted,
          nonce: _users.nonce,
          status: _users.status,
          role: _users.role,
          walletAddress: _users.walletAddress,
          totalUSDTBalance: 0,
          password: '',
        });
      }
    }

    await dataSource.getRepository(TokenTransactions).save(
      tokenTransactions.map((_tokenTransactions) => {
        return {
          blockNumber: _tokenTransactions.blockNumber,
          fromAddress: _tokenTransactions.fromAddress,
          status: _tokenTransactions.status,
          toAddress: _tokenTransactions.toAddress,
          transactionHash: _tokenTransactions.transactionHash,
          transactionHashDeposit: _tokenTransactions.transactionHashDeposit,
          transactionHashMatic: _tokenTransactions.transactionHashMatic,
          value: _tokenTransactions.value,
        };
      }),
    );

    const transactionsChunk = chunk_inefficient(transactions, 300);
    console.log('chunks', transactionsChunk.length);
    for (const [index, _transactionsChunk] of transactionsChunk.entries()) {
      if (index < 51) {
        continue;
      }
      console.log(`transactionsChunk: ${index}`);
      await dataSource.getRepository(Transaction).save(
        _transactionsChunk.map((_transactions) => {
          return {
            accountAddress: _transactions.accountAddress,
            amount: String(_transactions.amount),
            operation: _transactions.operation,
            blockchainTxId: _transactions.blockchainTxId,
            description: _transactions.description,
            operationDetails: _transactions.operationDetails,
            status: _transactions.status,
            systemFee: _transactions.systemFee,
            toAccountAddress: _transactions.toAccountAddress,
          };
        }),
      );
    }

    const NFTAirdropDailyReportChunk = chunk_inefficient(
      nftAirdropDailyReport,
      300,
    );

    const existUsers = await dataSource.getRepository(User).find({
      select: ['id', 'walletAddress'],
    });

    console.log('existUsers', existUsers.length);
    console.log('chunks', NFTAirdropDailyReportChunk.length);

    for (const [
      index,
      _NFTAirdropDailyReportChunk,
    ] of NFTAirdropDailyReportChunk.entries()) {
      console.log(`NFTAirdropDailyReportChunk: ${index}`);
      await dataSource.getRepository(NFTAirdropDailyReport).save(
        _NFTAirdropDailyReportChunk.map((_record) => {
          return {
            accountAddress: _record?.accountAddress,
            claimedBefore: _record?.claimedBefore,
            status: _record?.status,
            tokens: _record?.tokens,
            user: existUsers?.find(
              (_existUsers) =>
                String(_existUsers.walletAddress).toLowerCase() ===
                String(_record?.accountAddress).toLowerCase(),
            ),
            totalNFTs: _record?.totalNFTs,
            uniqueKey: _record?.uniqueKey,
          };
        }),
      );
    }

    return true;
  }
}
