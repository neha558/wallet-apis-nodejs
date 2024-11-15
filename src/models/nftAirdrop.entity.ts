import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './users.entity';

@Entity({ name: 'module_web3_wallet_nft_airdrop_daily_report' })
export class NFTAirdropDailyReport {
  @Column({
    type: 'text',
    name: 'account_address',
  })
  accountAddress: string;

  @Column({
    type: 'int',
  })
  totalNFTs: number;

  @Column({
    type: 'int',
  })
  tokens: number;

  @Column({ type: 'datetime' })
  claimedBefore: Date | string;

  @Column({
    type: 'text',
    default: 'pending',
  })
  status: string; // pending / claimed

  @Column({
    type: 'text',
    name: 'unique_key',
    unique: true,
    nullable: true,
  })
  uniqueKey: string;

    @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @CreateDateColumn({ type: 'datetime', default: () => 'NOW' })
  createDateTime: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  createdBy: string;

  @UpdateDateColumn({ type: 'datetime', default: () => 'NOW' })
  lastChangedDateTime: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  lastChangedBy: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  internalComment: string | null;

  @ManyToOne(() => User, (user) => user.nftAirdropDailyReport)
  user: User;
}
