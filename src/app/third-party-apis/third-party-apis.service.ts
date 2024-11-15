import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Transaction } from 'src/models/transactions.entity';
import { configService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';

interface TxData {
  transaction_id: string | number;
  transaction_type: string;
  transaction_amount: string;
  accountAddress: string;
  userId: any;
  message?: string;
}

@Injectable()
export class ThirdPartyApisService {
  constructor(private readonly databaseService: DatabaseService) {}

  baseURL = configService.getWalletThirdPartyBaseURL();
  accessKey = configService.getWalletThirdPartyAPIKey();

  async doLogin(userId) {
    try {
      const response = await axios.post(
        `${this.baseURL}wallet-client/api/auth/login`,
        {
          user_id: userId,
        },
        {
          headers: {
            'x-access-key': this.accessKey,
          },
        },
      );

      return response?.data?.data;
    } catch (error) {
      console.log('Error in ThirdPartyApisService:: doLogin', error);
    }
  }

  async addTx(data: TxData) {
    try {
      console.log('data', data);
      const accessToken = await this.doLogin(data?.userId);
      const currentState = await this.getCurrentStats(data?.accountAddress);
      const response = await axios.post(
        `${this.baseURL}wallet-client/api/transaction-log/create`,
        {
          transaction_id: data?.transaction_id,
          transaction_type: data?.transaction_type, // pass Debit or Credit type
          transaction_amount: String(data?.transaction_amount),
          wallet_current_balance: currentState?.available,
          message: data?.message || 'Credited from outside app',
        },
        {
          headers: {
            'x-access-key': this.accessKey,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      console.log(['addTx', JSON.stringify(response?.data)]);
      return response?.data?.data;
    } catch (error) {
      console.log('Error in ThirdPartyApisService:: addTx', error);
    }
  }

  async getCurrentStats(accountAddress: string) {
    const datasource = await this.databaseService.getDataSource();

    const data = await Promise.all([
      datasource.manager
        .getRepository(Transaction)
        .query(
          `SELECT SUM(amount) as deposited FROM module_web3_wallet_transactions WHERE LOWER(account_address)='${accountAddress?.toLowerCase()}' AND operation='deposit' AND status='success'`,
        ),
      datasource.manager
        .getRepository(Transaction)
        .query(
          `SELECT SUM(amount) as withdraw FROM module_web3_wallet_transactions WHERE LOWER(account_address)='${accountAddress?.toLowerCase()}' AND (operation='withdraw' OR operation='deduct') AND status='success'`,
        ),
      datasource.manager
        .getRepository(Transaction)
        .query(
          `SELECT SUM(amount) as withdraw FROM module_web3_wallet_transactions WHERE LOWER(account_address)='${accountAddress?.toLowerCase()}' AND (operation='withdraw' OR operation='deduct') AND status='inprogress'`,
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
    };
  }
}
