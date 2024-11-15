import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Config } from 'src/models/config.entity';
import { TokenTransactions } from 'src/models/tokenTransactions.entity';
import { User } from 'src/models/users.entity';
import { configService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { tokenABI, walletABI } from '../common/constants/web3.constants';
import { Transaction } from 'src/models/transactions.entity';
import { ThirdPartyApisService } from '../third-party-apis/third-party-apis.service';
import { In } from 'typeorm';
import { USDTTransaction } from 'src/models/usdt_transactions.entity';

const Web3 = require('web3');

const web3 = new Web3('https://polygon-rpc.com/');
const chain = 'polygon';

const moralisAPI = configService.getMoralisAPIUrl();
const moralisAPIKey = configService.getMoralisAPIKey();
const contractAddress = configService.getContractAddress();

const topics = {
  TOKEN_TRANSFER:
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  WALLET_WITHDRAW:
    '0x9a0048b724709102eb1a35f31b8f72c754c9f7a0490bfaa8d3e5edc3a8133da4',
  TOKEN_TRANSFER_USDT:
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
};

const moralisAPIPath = {
  transferToken: `${moralisAPI}erc20/${contractAddress}/transfers?chain=${chain}`,
  txDetails: (tx) => `${moralisAPI}transaction/${tx}/verbose?chain=polygon`,
  walletTx: `${moralisAPI}${configService.getWalletContractAddress()}/events?chain=polygon&topic=${
    topics.WALLET_WITHDRAW
  }`,
  myNFTs: (address) =>
    `${moralisAPI}${address}/nft?chain=polygon&format=decimal&token_addresses[]=0x6da8a67989cbecbc971d574522081df25416b057&disable_total=false&limit=1`,
  nftPackNFTs: (address) => {
    return `${moralisAPI}${address}/nft/transfers?chain=polygon&format=decimal&token_addresses[]=0x6da8a67989cbecbc971d574522081df25416b057&disable_total=false&limit=1&from_block=40752515&to_block=41093248`;
  },
};

const eventsABI = {
  transferToken: {},
};

const topicsABIs = {
  TOKEN_TRANSFER: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
  WALLET_WITHDRAW: {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: '_address',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'id',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: '_time',
        type: 'uint256',
      },
    ],
    name: 'Withdraw',
    type: 'event',
  },
};

const topicsABIsMap = {
  [topics.TOKEN_TRANSFER]: topicsABIs.TOKEN_TRANSFER,
  [topics.WALLET_WITHDRAW]: topicsABIs.WALLET_WITHDRAW,
};

@Injectable()
export class Web3Service {
  static web3 = web3;
  constructor(
    private databaseService: DatabaseService,
    private thirdPartyApisService: ThirdPartyApisService,
  ) {}

  createAccount() {
    const account = web3.eth.accounts.create();
    const encrypted = web3.eth.accounts.encrypt(
      account?.privateKey,
      configService.getEncryptionKey(),
    );

    return {
      address: account?.address,
      encrypted,
    };
  }

  decryptPrivateKey(encrypted) {
    return web3.eth.accounts.decrypt(
      encrypted,
      configService.getEncryptionKey(),
    );
  }

  async getTokenTransferEvents() {
    const datasource = await this.databaseService.getDataSource();
    const fromBlock = await datasource.getRepository(Config).findOne({
      where: {
        name: 'transferToken',
      },
    });

    let from_block = configService.getContractDeploymentBlock();

    if (fromBlock) {
      from_block = fromBlock?.value;
    }

    let response;
    let records = [];

    let page = 1;
    do {
      const url = `${
        moralisAPIPath.transferToken
      }&from_block=${from_block}&offset=${
        (page - 1) * 100
      }&disable_total=true&cacheBuster=${new Date().getTime()}`;

      response = await axios.get(url, {
        headers: {
          'X-API-Key': moralisAPIKey,
        },
      });
      console.log([url, JSON.stringify(response?.data)]);

      if (page === 1 && response?.data?.result?.[0]?.block_number) {
        await datasource.getRepository(Config).save({
          id: fromBlock?.id,
          name: 'transferToken',
          value: String(
            parseInt(response?.data?.result?.[0]?.block_number) + 1,
          ),
        });
        page++;
      }

      records = [...records, ...response?.data?.result];
    } while (response?.data?.result?.length > 0);

    await this.saveTokenTransaction(records);

    return records;
  }

  async moralisWebhook(data) {
    console.log(['Moralis webhook', JSON.stringify(data)]);
    const logs = data?.logs;

    for (let index = 0; index < logs.length; index++) {
      const log = logs[index];
      const encodedData = log?.data;
      const confirmed = data?.confirmed;
      const blockNumber = data?.block?.number;

      if (confirmed) {
        return;
      }

      console.log(topicsABIsMap?.[log?.topic0]?.inputs, encodedData, [
        log?.topic0,
      ]);

      if (log?.topic0 === topics.TOKEN_TRANSFER) {
        const erc20Transfers = data?.erc20Transfers;
        if (erc20Transfers?.length > 0) {
          const records = erc20Transfers?.map((eventData) => {
            return {
              ...eventData,
              block_number: blockNumber,
              to_address: eventData?.to,
              from_address: eventData?.from,
              transaction_hash: eventData?.transactionHash,
              log,
            };
          });
          await this.saveTokenTransaction(records);
          continue;
        }
        continue;
      }
    }
  }

  async saveTokenTransaction(data) {
    try {
      const datasource = await this.databaseService.getDataSource();

      for (const d of data) {
        try {
          const validateTx = await axios.get(
            moralisAPIPath.txDetails(d?.transaction_hash),
            {
              headers: {
                'X-API-Key': moralisAPIKey,
              },
            },
          );

          const transferLog = validateTx?.data?.logs?.find(
            (log) => log?.topic0 === topics.TOKEN_TRANSFER,
          );

          const transferDetails = transferLog?.decoded_event;

          const from = transferDetails?.params?.find(
            (param) => param?.name === 'from',
          )?.value;

          const to = transferDetails?.params?.find(
            (param) => param?.name === 'to',
          )?.value;

          const value = transferDetails?.params?.find(
            (param) => param?.name === 'value',
          )?.value;

          if (
            String(validateTx?.data?.hash).toLowerCase() ===
              d?.transaction_hash?.toLowerCase() &&
            d?.from_address?.toLowerCase() === from?.toLowerCase() &&
            d?.to_address?.toLowerCase() === to?.toLowerCase() &&
            d?.value === value
          ) {
            const formatedData = {
              blockNumber: d?.block_number,
              toAddress: d?.to_address,
              fromAddress: d?.from_address,
              transactionHash: d?.transaction_hash,
              status: 'received',
              value: d?.value,
            };
            await datasource
              .getRepository(TokenTransactions)
              .save(formatedData);
          } else {
            console.log([
              '=========== INVALID TX ============',
              validateTx.data,
            ]);
          }
        } catch (error) {
          console.log(['saveTokenTransactionError', error?.message]);
        }
      }
      await this.holdReceivedAmount();
    } catch (error) {
      console.log(['saveTokenTransactionError', error?.message]);
    }
  }

  async holdReceivedAmount() {
    const datasource = await this.databaseService.getDataSource();
    const userAddress = await datasource.getRepository(User).find();

    const receivedAmount = await datasource
      .getRepository(TokenTransactions)
      .find({
        where: {
          status: 'received',
        },
      });

    const receivedAmountForUsers = receivedAmount?.filter((r) => {
      if (
        userAddress?.some(
          (a) =>
            String(a?.accountAddress).toLowerCase() ===
            String(r?.toAddress).toLowerCase(),
        )
      ) {
        return true;
      }
      return false;
    });

    for (const receivedAmountForUser of receivedAmountForUsers) {
      await datasource.getRepository(TokenTransactions).update(
        {
          id: receivedAmountForUser?.id,
        },
        {
          status: 'selected_for_deposit',
        },
      );

      const user = userAddress?.find(
        (a) =>
          String(a?.accountAddress).toLowerCase() ===
          String(receivedAmountForUser?.toAddress).toLowerCase(),
      );

      const saved = await datasource.getRepository(Transaction).save({
        accountAddress: user?.accountAddress,
        amount: web3.utils.fromWei(receivedAmountForUser?.value),
        operation: 'deposit',
        status: 'success',
        operationDetails: 'Deposited Directly from user',
      });

      const receipt = await this.transferMaticToWallet(
        receivedAmountForUser?.toAddress,
      );

      await this.thirdPartyApisService.addTx({
        userId: user?._id,
        accountAddress: user?.accountAddress,
        transaction_amount: saved?.amount,
        transaction_id: receipt?.transactionHash,
        transaction_type: 'Credit',
      });

      await datasource.getRepository(TokenTransactions).update(
        {
          id: receivedAmountForUser?.id,
        },
        {
          status: 'sent_matic',
          transactionHashMatic: receipt?.transactionHash,
        },
      );

      await this.transferCubixToContract(
        user?.accountAddress,
        receivedAmountForUser?.value,
        user?.encrypted,
        receivedAmountForUser?.id,
        saved?.id,
        saved?.amount,
      );
    }
    return receivedAmountForUsers;
  }

  async checkAndRetryTx() {
    const datasource = await this.databaseService.getDataSource();
    const userAddress = await datasource.getRepository(User).find();

    const receivedAmountForUsers = await datasource
      .getRepository(TokenTransactions)
      .find({
        where: {
          status: 'cubix_hold_failed',
        },
      });

    for (const receivedAmountForUser of receivedAmountForUsers) {
      const user = userAddress?.find(
        (a) =>
          String(a?.accountAddress).toLowerCase() ===
          String(receivedAmountForUser?.toAddress).toLowerCase(),
      );

      const saved = await datasource.getRepository(Transaction).save({
        accountAddress: user?.accountAddress,
        amount: web3.utils.fromWei(receivedAmountForUser?.value),
        operation: 'deposit',
        status: 'pending',
        operationDetails: 'Deposited Directly',
      });

      await this.transferCubixToContract(
        user?.accountAddress,
        receivedAmountForUser?.value,
        user?.encrypted,
        receivedAmountForUser?.id,
        saved?.id,
        saved?.amount,
      );
    }
  }

  async getLatestBlockGasFee() {
    const response = await axios.get(
      `https://gasstation-mainnet.matic.network/v2`,
    );

    return {
      // matic: web3.utils.fromWei(String(response?.data?.standard?.maxFee)),
      matic: web3.utils.toWei('0.02'),
      gwe: String(response?.data?.standard?.maxFee),
    };
    // 1 MATIC - 1000000000 GWE
    // x MATIC - 243.59189772766666 GWE
  }

  async transferMaticToWallet(address: string) {
    const gasPrice = await this.getLatestBlockGasFee();

    const transactionParameters = {
      from: configService.getMaticDepositorAddress(),
      to: address,
      data: '0x',
      value: gasPrice?.matic,
      gas: 500000,
      gasFee: gasPrice?.gwe,
    };

    const signedTx = await web3.eth.accounts.signTransaction(
      transactionParameters,
      configService.getMaticDepositorPrivateKey(),
    );

    console.log(['transferMaticToWallet', transactionParameters, signedTx]);

    const receipt = await web3.eth.sendSignedTransaction(
      signedTx?.rawTransaction,
    );

    console.log(['receipt', receipt]);

    return receipt;
  }

  async transferCubixToContract(
    address: string,
    amount: string,
    encrypted: string,
    tokenTxId: number,
    txId: number,
    amountOnly: any,
  ) {
    try {
      const datasource = await this.databaseService.getDataSource();

      const cubixContract = this.getCubixContracAddress(address);
      const gasPrice = await this.getLatestBlockGasFee();

      const encodedABI = cubixContract.methods
        .transfer(configService.getWalletContractAddress(), amount)
        .encodeABI();

      const dataForTx = {
        to: configService.getContractAddress(),
        from: address,
        gas: 100000,
        data: encodedABI,
        gasFee: gasPrice?.gwe,
      };

      const signedTx = await web3.eth.accounts.signTransaction(
        dataForTx,
        this.decryptPrivateKey(encrypted)?.privateKey,
      );

      console.log(['dataForTx', dataForTx, signedTx]);

      const receipt = await web3.eth.sendSignedTransaction(
        signedTx?.rawTransaction,
      );

      console.log(['receipt', receipt]);

      await datasource.getRepository(TokenTransactions).update(
        {
          id: tokenTxId,
        },
        {
          status: 'holded',
          transactionHashDeposit: receipt?.transactionHash,
        },
      );

      await datasource.getRepository(Transaction).update(
        {
          id: txId,
        },
        {
          blockchainTxId: receipt?.transactionHash,
          status: 'success',
        },
      );

      return receipt;
    } catch (error) {
      this.setErrorFailedWhileCubixTransfer(tokenTxId, txId);
    }
  }

  async setErrorFailedWhileCubixTransfer(tokenTxId: number, txId: number) {
    const datasource = await this.databaseService.getDataSource();

    await datasource.getRepository(TokenTransactions).update(
      {
        id: tokenTxId,
      },
      {
        status: 'cubix_hold_failed',
      },
    );

    await datasource.getRepository(Transaction).update(
      {
        id: txId,
      },
      {
        status: 'rejected',
      },
    );
  }

  getCubixContracAddress(address) {
    const cubixContract = new web3.eth.Contract(
      tokenABI,
      configService.getContractAddress(),
      {
        from: address,
      },
    );
    return cubixContract;
  }

  getPackContractAddress(address) {
    const cubixContract = new web3.eth.Contract(
      tokenABI,
      configService.getPackContractAddress(),
      {
        from: address,
      },
    );
    return cubixContract;
  }

  getWalletContracAddress(address) {
    const walletContract = new web3.eth.Contract(
      walletABI,
      configService.getWalletContractAddress(),
      {
        from: address,
      },
    );
    return walletContract;
  }

  async withdrawCubixToContract(address: string, amount: string, id: number) {
    const datasource = await this.databaseService.getDataSource();

    try {
      const walletContract = this.getWalletContracAddress(
        configService.getMaticDepositorAddress(),
      );
      const gasPrice = await this.getLatestBlockGasFee();

      const encodedABI = walletContract.methods
        .withdraw(address, web3.utils.toWei(String(amount)), 0)
        .encodeABI();

      const dataForTx = {
        to: configService.getWalletContractAddress(),
        from: configService.getMaticDepositorAddress(),
        gas: 500000,
        data: encodedABI,
        gasFee: gasPrice?.gwe,
      };

      const signedTx = await web3.eth.accounts.signTransaction(
        dataForTx,
        configService.getMaticDepositorPrivateKey(),
      );

      console.log(['dataForTx', dataForTx, signedTx]);

      const receipt = await web3.eth.sendSignedTransaction(
        signedTx?.rawTransaction,
      );

      console.log(['receipt', receipt]);

      await datasource.getRepository(Transaction).update(
        { id },
        {
          status: 'success',
          blockchainTxId: receipt?.transactionHash,
        },
      );

      const user = await datasource
        .getRepository(User)
        .findOne({ where: { accountAddress: address } });

      await this.thirdPartyApisService.addTx({
        userId: user?._id,
        accountAddress: user?.accountAddress,
        transaction_amount: amount,
        transaction_id: receipt?.transactionHash,
        transaction_type: 'Debit',
      });

      return receipt;
    } catch (error) {
      await datasource.getRepository(Transaction).update(
        {
          id,
        },
        {
          status: 'rejected',
        },
      );
    }
  }

  async updateTx() {
    const datasource = await this.databaseService.getDataSource();

    const fromBlock = await datasource.getRepository(Config).findOne({
      where: {
        name: 'walletTxUpdate',
      },
    });

    let from_block = configService.getContractDeploymentBlock();

    if (fromBlock) {
      from_block = fromBlock?.value;
    }

    let response;
    let records = [];

    let page = 1;
    do {
      const url = `${moralisAPIPath.walletTx}&from_block=${from_block}&offset=${
        (page - 1) * 100
      }`;

      response = await axios.post(url, topicsABIs.WALLET_WITHDRAW, {
        headers: {
          'X-API-Key': moralisAPIKey,
        },
      });

      console.log([url, JSON.stringify(response?.data)]);

      if (page === 1 && response?.data?.result?.[0]?.block_number) {
        await datasource.getRepository(Config).save({
          id: fromBlock?.id,
          name: 'walletTxUpdate',
          value: String(
            parseInt(response?.data?.result?.[0]?.block_number) + 1,
          ),
        });
      }
      page++;

      records = [...records, ...response?.data?.result];
    } while (response?.data?.result?.length > 0);

    await datasource.getRepository(Transaction).update(
      {
        id: In(records?.map((_data) => _data?.data?.uid)),
      },
      {
        status: 'success',
      },
    );
  }

  async getTotalNFTs(owner: any) {
    const config = {
      method: 'get',
      url: `${moralisAPIPath.myNFTs(owner)}`,
      iplNFTURL: `${moralisAPIPath.nftPackNFTs(owner)}`,
    };

    const [response, iplNFTs] = await Promise.all([
      axios.get(config.url, {
        headers: {
          'X-API-Key': moralisAPIKey,
        },
      }),
      axios.get(`${config.iplNFTURL}`, {
        headers: {
          'X-API-Key': moralisAPIKey,
        },
      }),
    ]);

    return response?.data?.total - iplNFTs?.data?.total;
  }

  // USDT
  async moralisWebhookUSDT(data) {
    console.log(['Moralis webhook USDT', JSON.stringify(data)]);
    const logs = data?.logs;

    for (let index = 0; index < logs.length; index++) {
      const log = logs[index];
      const encodedData = log?.data;
      const confirmed = data?.confirmed;
      const blockNumber = data?.block?.number;

      if (confirmed) {
        return;
      }

      console.log(topicsABIsMap?.[log?.topic0]?.inputs, encodedData, [
        log?.topic0,
      ]);

      if (log?.topic0 === topics.TOKEN_TRANSFER) {
        const erc20Transfers = data?.erc20Transfers;
        if (erc20Transfers?.length > 0) {
          const records = erc20Transfers?.map((eventData) => {
            return {
              ...eventData,
              block_number: blockNumber,
              to_address: eventData?.to,
              from_address: eventData?.from,
              transaction_hash: eventData?.transactionHash,
              log,
            };
          });
          await this.saveTokenTransactionUSDT(records);
          continue;
        }
        continue;
      }
    }
  }

  async saveTokenTransactionUSDT(data) {
    try {
      const datasource = await this.databaseService.getDataSource();

      for (const d of data) {
        try {
          const validateTx = await axios.get(
            moralisAPIPath.txDetails(d?.transaction_hash),
            {
              headers: {
                'X-API-Key': moralisAPIKey,
              },
            },
          );

          const transferLog = validateTx?.data?.logs?.find(
            (log) => log?.topic0 === topics.TOKEN_TRANSFER_USDT,
          );

          const transferDetails = transferLog?.decoded_event;

          const from = transferDetails?.params?.find(
            (param) => param?.name === 'from',
          )?.value;

          const to = transferDetails?.params?.find(
            (param) => param?.name === 'to',
          )?.value;

          const value = transferDetails?.params?.find(
            (param) => param?.name === 'value',
          )?.value;

          if (
            String(validateTx?.data?.hash).toLowerCase() ===
              d?.transaction_hash?.toLowerCase() &&
            d?.from_address?.toLowerCase() === from?.toLowerCase() &&
            d?.to_address?.toLowerCase() === to?.toLowerCase() &&
            d?.value === value
          ) {
            await datasource.getRepository(USDTTransaction).save({
              accountAddress: d?.to_address,
              operation: 'deposited',
              status: 'received',
              blockchainTxId: d?.transaction_hash,
              transactionHash: d?.transaction_hash,
              amount: d?.value,
              toAccountAddress: d?.to_address,
            });
          } else {
            console.log([
              '=========== INVALID TX ============',
              validateTx.data,
            ]);
          }
        } catch (error) {
          console.log(['saveTokenTransactionError', error?.message]);
        }
      }
      await this.holdReceivedAmountUSDT();
    } catch (error) {
      console.log(['saveTokenTransactionError', error?.message]);
    }
  }

  async holdReceivedAmountUSDT() {
    const datasource = await this.databaseService.getDataSource();

    const receivedAmountForUsers = await datasource
      .getRepository(USDTTransaction)
      .find({
        where: {
          status: 'received',
        },
      });

    for (const receivedAmountForUser of receivedAmountForUsers) {
      await datasource.getRepository(USDTTransaction).update(
        {
          id: receivedAmountForUser?.id,
        },
        {
          status: 'selected_for_deposit',
        },
      );

      const user = await datasource.getRepository(User).findOne({
        where: {
          accountAddress: receivedAmountForUser?.accountAddress,
        },
      });

      await datasource.getRepository(User).update(
        {
          accountAddress: receivedAmountForUser?.accountAddress,
        },
        {
          totalUSDTBalance: Number(
            user?.totalUSDTBalance ?? 0 + receivedAmountForUser?.amount,
          ),
        },
      );

      const receipt = await this.transferMaticToWallet(
        receivedAmountForUser?.accountAddress,
      );

      await datasource.getRepository(USDTTransaction).update(
        {
          id: receivedAmountForUser?.id,
        },
        {
          status: 'sent_matic',
          transactionHashMatic: receipt?.transactionHash,
        },
      );

      await this.transferUSDTToContract(
        user?.accountAddress,
        receivedAmountForUser?.amount,
        user?.encrypted,
        receivedAmountForUser?.id,
        receivedAmountForUser?.id,
      );
    }
    return receivedAmountForUsers;
  }

  async transferUSDTToContract(
    address: string,
    amount: string,
    encrypted: string,
    tokenTxId: number,
    txId: number,
  ) {
    try {
      const datasource = await this.databaseService.getDataSource();

      const cubixContract = this.getPackContractAddress(address);
      const gasPrice = await this.getLatestBlockGasFee();

      const encodedABI = cubixContract.methods
        .transfer(configService.getPackContractAddress(), amount)
        .encodeABI();

      const dataForTx = {
        to: configService.getUSDTContractAddress(),
        from: address,
        gas: 100000,
        data: encodedABI,
        gasFee: gasPrice?.gwe,
      };

      const signedTx = await web3.eth.accounts.signTransaction(
        dataForTx,
        this.decryptPrivateKey(encrypted)?.privateKey,
      );

      console.log(['dataForTx', dataForTx, signedTx]);

      const receipt = await web3.eth.sendSignedTransaction(
        signedTx?.rawTransaction,
      );

      console.log(['receipt', receipt]);

      await datasource.getRepository(USDTTransaction).update(
        {
          id: tokenTxId,
        },
        {
          status: 'holded',
          transactionHashDeposit: receipt?.transactionHash,
        },
      );

      await datasource.getRepository(USDTTransaction).update(
        {
          id: txId,
        },
        {
          blockchainTxId: receipt?.transactionHash,
          status: 'success',
        },
      );

      return receipt;
    } catch (error) {
      this.setErrorFailedWhileCubixTransfer(tokenTxId, txId);
    }
  }
  // USDT done
}
