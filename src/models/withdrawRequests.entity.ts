import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transaction } from './transactions.entity';

@Entity({ name: 'module_web3_wallet_withdraw_requests' })
export class WithdrawRequest {
  @Column({
    type: 'float',
  })
  amount: string;

  @Column({
    type: 'text',
    name: 'account_address',
  })
  accountAddress: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'blockchain_tx_id',
  })
  blockchainTxId: string;

  @Column({
    type: 'text',
    default: 'pending',
  })
  status: string;

  @OneToOne(() => Transaction)
  @JoinColumn()
  transaction: Transaction;

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
}
