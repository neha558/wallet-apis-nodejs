import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

require('dotenv').config();

class ConfigService {
  constructor(private env: { [k: string]: string | undefined }) {}

  private getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key];
    if (!value && throwOnMissing) {
      throw new Error(`config error - missing env.${key}`);
    }

    return value;
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true));
    return this;
  }

  public getPort() {
    return this.getValue('PORT', true);
  }

  public isProduction() {
    const mode = this.getValue('MODE', false);
    return mode != 'DEV';
  }

  public getDomain() {
    const domain = this.getValue('DOMAIN_NAME', false);
    return domain;
  }

  public getJWTSecret() {
    return this.getValue('JWT_SECRET', true);
  }

  public getEncryptionKey() {
    return this.getValue('ENCRYPTION_KEY', true);
  }

  public getTypeOrmConfig(): DataSourceOptions {
    return {
      type: 'mysql',
      host: this.getValue('DATABASE_HOST'),
      port: parseInt(this.getValue('DATABASE_PORT')),
      username: this.getValue('DATABASE_USER'),
      password: this.getValue('DATABASE_PASSWORD'),
      database: this.getValue('DATABASE_DATABASE'),

      migrationsTableName: 'module_web3_wallet_migration',

      ssl: false,

      entities: ['dist/**/*.entity{.ts,.js}'],
      migrations: ['dist/src/migration/*.js'],
      // cli: {
      //   migrationsDir: 'dist/src/migration',
      // },
    };
  }

  public getMoralisAPIUrl() {
    return this.getValue('MORALIS_API_URL', true);
  }

  public getMoralisAPIKey() {
    return this.getValue('MORALIS_API_KEY', true);
  }

  public getContractAddress() {
    return this.getValue('CONTRACT_ADDRESS', true);
  }

  public getPackContractAddress() {
    return this.getValue('PACK_CONTRACT_ADDRESS', true);
  }

  public getUSDTContractAddress() {
    return this.getValue('USDT_CONTRACT_ADDRESS', true);
  }

  public getWalletAuthKey() {
    return this.getValue('WALLET_AUTH_API_KEY', true);
  }

  public getContractDeploymentBlock() {
    return this.getValue('CONTRACT_DEPLOYMENT_BLOCK', true);
  }

  public getMaticDepositorPrivateKey() {
    return this.getValue('MATIC_DEPOSITOR_PRIVATE_KEY', true);
  }

  public getMaticDepositorAddress() {
    return this.getValue('MATIC_DEPOSITOR_ADDRESS', true);
  }

  public getWalletContractAddress() {
    return this.getValue('WALLET_CONTRACT_ADDRESS', true);
  }

  public getWalletThirdPartyAPIKey() {
    return this.getValue('WALLET_THIRD_PARTY_API_KEY', true);
  }

  public getWalletThirdPartyBaseURL() {
    return this.getValue('WALLET_THIRD_PARTY_API_BASE_URL', true);
  }
}

const configService = new ConfigService(process.env).ensureValues([
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_DATABASE',
  'JWT_SECRET',
  'DOMAIN_NAME',
]);

export { configService };
